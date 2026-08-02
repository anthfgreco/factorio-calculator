#!/usr/bin/env python3
"""Archive every current page from the Official Factorio Wiki into Markdown.

The MediaWiki API is used instead of following links so that orphaned pages,
templates, modules, talk pages, and other non-article namespaces are included.
The exact page source is written to one Markdown file. A SQLite copy is retained
for resumability and integrity checks. File description pages and current file
metadata are archived; binary media is not downloaded.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


API_URL = "https://wiki.factorio.com/api.php"
USER_AGENT = (
    "FactorioCalculatorWikiArchiver/1.0 "
    "(https://github.com/anthfgreco/factorio-calculator)"
)
DEFAULT_OUTPUT = Path(".tmp/factorio-wiki.sqlite")
DEFAULT_MARKDOWN_OUTPUT = Path("factorio-wiki.md")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WikiClient:
    def __init__(self, delay: float, timeout: float, retries: int) -> None:
        self.delay = delay
        self.timeout = timeout
        self.retries = retries
        self.last_request_finished = 0.0

    def get(self, parameters: dict[str, Any]) -> dict[str, Any]:
        query = {
            "format": "json",
            "formatversion": "2",
            "maxlag": "5",
            **parameters,
        }
        url = f"{API_URL}?{urllib.parse.urlencode(query)}"

        for attempt in range(self.retries + 1):
            elapsed = time.monotonic() - self.last_request_finished
            if elapsed < self.delay:
                time.sleep(self.delay - elapsed)

            request = urllib.request.Request(
                url,
                headers={"Accept": "application/json", "User-Agent": USER_AGENT},
            )
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    result = json.load(response)
                self.last_request_finished = time.monotonic()

                error = result.get("error")
                if error is None:
                    return result
                if error.get("code") != "maxlag":
                    raise RuntimeError(f"MediaWiki API error: {error}")
                retry_after = float(error.get("lag", 0)) + 1.0
            except urllib.error.HTTPError as error:
                self.last_request_finished = time.monotonic()
                if error.code not in {429, 500, 502, 503, 504}:
                    raise
                retry_after = float(error.headers.get("Retry-After", 0) or 0)
            except (TimeoutError, urllib.error.URLError):
                self.last_request_finished = time.monotonic()
                retry_after = 0.0

            if attempt == self.retries:
                raise RuntimeError(f"Request failed after {self.retries + 1} attempts: {url}")

            backoff = max(retry_after, 2**attempt) + random.random()
            print(f"Request throttled or failed; retrying in {backoff:.1f}s", file=sys.stderr)
            time.sleep(backoff)

        raise AssertionError("unreachable")


def connect_database(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS namespaces (
            namespace_id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            canonical_name TEXT,
            is_content INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pages (
            page_id INTEGER PRIMARY KEY,
            namespace_id INTEGER NOT NULL,
            title TEXT NOT NULL UNIQUE,
            is_redirect INTEGER NOT NULL,
            content_model TEXT,
            page_language TEXT,
            touched TEXT,
            latest_revision_id INTEGER,
            revision_parent_id INTEGER,
            revision_timestamp TEXT,
            revision_user TEXT,
            revision_user_id INTEGER,
            revision_comment TEXT,
            revision_size INTEGER,
            revision_sha1 TEXT,
            content_format TEXT,
            wikitext TEXT,
            retrieved_at TEXT NOT NULL,
            FOREIGN KEY (namespace_id) REFERENCES namespaces(namespace_id)
        );

        CREATE INDEX IF NOT EXISTS pages_namespace_title
            ON pages(namespace_id, title);

        CREATE TABLE IF NOT EXISTS files (
            page_id INTEGER PRIMARY KEY,
            canonical_title TEXT,
            timestamp TEXT,
            user TEXT,
            user_id INTEGER,
            comment TEXT,
            size INTEGER,
            width INTEGER,
            height INTEGER,
            sha1 TEXT,
            mime TEXT,
            media_type TEXT,
            url TEXT,
            description_url TEXT,
            metadata_json TEXT,
            FOREIGN KEY (page_id) REFERENCES pages(page_id)
        );

        CREATE TABLE IF NOT EXISTS crawl_state (
            namespace_id INTEGER PRIMARY KEY,
            continuation_json TEXT,
            completed INTEGER NOT NULL DEFAULT 0,
            page_count INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (namespace_id) REFERENCES namespaces(namespace_id)
        );
        """
    )
    return connection


def set_metadata(connection: sqlite3.Connection, key: str, value: Any) -> None:
    serialized = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    connection.execute(
        "INSERT INTO metadata(key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, serialized),
    )


def load_site_info(client: WikiClient) -> dict[str, Any]:
    response = client.get(
        {
            "action": "query",
            "meta": "siteinfo",
            "siprop": "general|namespaces|namespacealiases|statistics|rightsinfo",
        }
    )
    return response["query"]


def revision_values(page: dict[str, Any]) -> tuple[Any, ...]:
    revisions = page.get("revisions", [])
    revision = revisions[0] if revisions else {}
    main_slot = revision.get("slots", {}).get("main", {})
    return (
        revision.get("revid"),
        revision.get("parentid"),
        revision.get("timestamp"),
        revision.get("user"),
        revision.get("userid"),
        revision.get("comment"),
        revision.get("size"),
        revision.get("sha1"),
        main_slot.get("contentformat"),
        main_slot.get("content"),
    )


def save_page(connection: sqlite3.Connection, page: dict[str, Any], retrieved_at: str) -> None:
    revision = revision_values(page)
    connection.execute(
        """
        INSERT INTO pages(
            page_id, namespace_id, title, is_redirect, content_model,
            page_language, touched, latest_revision_id, revision_parent_id,
            revision_timestamp, revision_user, revision_user_id, revision_comment,
            revision_size, revision_sha1, content_format, wikitext, retrieved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(page_id) DO UPDATE SET
            namespace_id = excluded.namespace_id,
            title = excluded.title,
            is_redirect = excluded.is_redirect,
            content_model = excluded.content_model,
            page_language = excluded.page_language,
            touched = excluded.touched,
            latest_revision_id = COALESCE(excluded.latest_revision_id, pages.latest_revision_id),
            revision_parent_id = COALESCE(excluded.revision_parent_id, pages.revision_parent_id),
            revision_timestamp = COALESCE(excluded.revision_timestamp, pages.revision_timestamp),
            revision_user = COALESCE(excluded.revision_user, pages.revision_user),
            revision_user_id = COALESCE(excluded.revision_user_id, pages.revision_user_id),
            revision_comment = COALESCE(excluded.revision_comment, pages.revision_comment),
            revision_size = COALESCE(excluded.revision_size, pages.revision_size),
            revision_sha1 = COALESCE(excluded.revision_sha1, pages.revision_sha1),
            content_format = COALESCE(excluded.content_format, pages.content_format),
            wikitext = COALESCE(excluded.wikitext, pages.wikitext),
            retrieved_at = excluded.retrieved_at
        """,
        (
            page["pageid"],
            page["ns"],
            page["title"],
            int("redirect" in page),
            page.get("contentmodel"),
            page.get("pagelanguage"),
            page.get("touched"),
            *revision,
            retrieved_at,
        ),
    )

    image_info = page.get("imageinfo", [])
    if not image_info:
        return
    image = image_info[0]
    connection.execute(
        """
        INSERT INTO files(
            page_id, canonical_title, timestamp, user, user_id, comment, size,
            width, height, sha1, mime, media_type, url, description_url,
            metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(page_id) DO UPDATE SET
            canonical_title = excluded.canonical_title,
            timestamp = excluded.timestamp,
            user = excluded.user,
            user_id = excluded.user_id,
            comment = excluded.comment,
            size = excluded.size,
            width = excluded.width,
            height = excluded.height,
            sha1 = excluded.sha1,
            mime = excluded.mime,
            media_type = excluded.media_type,
            url = excluded.url,
            description_url = excluded.description_url,
            metadata_json = excluded.metadata_json
        """,
        (
            page["pageid"],
            image.get("canonicaltitle"),
            image.get("timestamp"),
            image.get("user"),
            image.get("userid"),
            image.get("comment"),
            image.get("size"),
            image.get("width"),
            image.get("height"),
            image.get("sha1"),
            image.get("mime"),
            image.get("mediatype"),
            image.get("url"),
            image.get("descriptionurl"),
            json.dumps(image.get("metadata", []), ensure_ascii=False),
        ),
    )


def scrape_namespace(
    connection: sqlite3.Connection,
    client: WikiClient,
    namespace_id: int,
    namespace_name: str,
    batch_size: int,
) -> int:
    state = connection.execute(
        "SELECT continuation_json, completed, page_count FROM crawl_state "
        "WHERE namespace_id = ?",
        (namespace_id,),
    ).fetchone()
    stored_page_count = connection.execute(
        "SELECT COUNT(*) FROM pages WHERE namespace_id = ?", (namespace_id,)
    ).fetchone()[0]
    if state and state[1]:
        print(
            f"[{namespace_id:>4}] {namespace_name or '(main)'}: "
            f"already complete ({stored_page_count} pages)"
        )
        return stored_page_count

    continuation = json.loads(state[0]) if state and state[0] else {}
    page_count = stored_page_count
    print(f"[{namespace_id:>4}] {namespace_name or '(main)'}: starting at {page_count} pages")

    while True:
        properties = "info|revisions"
        parameters: dict[str, Any] = {
            "action": "query",
            "generator": "allpages",
            "gapnamespace": namespace_id,
            "gaplimit": batch_size,
            "prop": properties,
            "inprop": "url",
            "rvprop": "ids|timestamp|user|userid|size|sha1|content|comment|contentmodel",
            "rvslots": "main",
            **continuation,
        }
        if namespace_id == 6:
            parameters["prop"] += "|imageinfo"
            parameters["iiprop"] = (
                "timestamp|user|userid|comment|canonicaltitle|url|size|dimensions|"
                "sha1|mime|mediatype|metadata"
            )

        response = client.get(parameters)
        pages = response.get("query", {}).get("pages", [])
        next_continuation = response.get("continue")
        retrieved_at = utc_now()

        with connection:
            for page in pages:
                save_page(connection, page, retrieved_at)
            page_count = connection.execute(
                "SELECT COUNT(*) FROM pages WHERE namespace_id = ?", (namespace_id,)
            ).fetchone()[0]
            connection.execute(
                """
                INSERT INTO crawl_state(
                    namespace_id, continuation_json, completed, page_count, updated_at
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(namespace_id) DO UPDATE SET
                    continuation_json = excluded.continuation_json,
                    completed = excluded.completed,
                    page_count = excluded.page_count,
                    updated_at = excluded.updated_at
                """,
                (
                    namespace_id,
                    json.dumps(next_continuation) if next_continuation else None,
                    int(next_continuation is None),
                    page_count,
                    retrieved_at,
                ),
            )

        if next_continuation is None:
            print(f"[{namespace_id:>4}] {namespace_name or '(main)'}: complete ({page_count} pages)")
            return page_count
        continuation = next_continuation


def markdown_fence(content: str) -> str:
    longest_run = max((len(match.group()) for match in re.finditer(r"`+", content)), default=0)
    return "`" * max(3, longest_run + 1)


def export_markdown(connection: sqlite3.Connection, output: Path) -> int:
    temporary_output = output.with_suffix(output.suffix + ".part")
    metadata = dict(connection.execute("SELECT key, value FROM metadata"))
    page_count = connection.execute("SELECT COUNT(*) FROM pages").fetchone()[0]
    file_count = connection.execute("SELECT COUNT(*) FROM files").fetchone()[0]

    output.parent.mkdir(parents=True, exist_ok=True)
    with temporary_output.open("w", encoding="utf-8", newline="\n") as markdown:
        markdown.write("# Official Factorio Wiki archive\n\n")
        markdown.write(f"- Source: <{metadata['source']}>\n")
        markdown.write(f"- Completed: {metadata['completed_at']}\n")
        markdown.write(f"- Pages: {page_count}\n")
        markdown.write(f"- Files with metadata: {file_count}\n")
        markdown.write(f"- Scope: {metadata['scope']}\n\n")
        markdown.write(
            "Each section contains the exact source of the page's current revision. "
            "The JSON comment is a machine-readable page boundary and revision record.\n\n"
        )

        rows = connection.execute(
            """
            SELECT
                p.page_id, p.namespace_id, n.name, p.title, p.is_redirect,
                p.content_model, p.latest_revision_id, p.revision_timestamp,
                p.revision_sha1, p.content_format, p.wikitext,
                f.url, f.mime, f.size, f.sha1
            FROM pages AS p
            JOIN namespaces AS n ON n.namespace_id = p.namespace_id
            LEFT JOIN files AS f ON f.page_id = p.page_id
            ORDER BY p.namespace_id, p.title
            """
        )
        for row in rows:
            (
                page_id,
                namespace_id,
                namespace_name,
                title,
                is_redirect,
                content_model,
                revision_id,
                revision_timestamp,
                revision_sha1,
                content_format,
                wikitext,
                file_url,
                file_mime,
                file_size,
                file_sha1,
            ) = row
            page_url = "https://wiki.factorio.com/" + urllib.parse.quote(
                title.replace(" ", "_"), safe="/:()"
            )
            record = {
                "page_id": page_id,
                "namespace_id": namespace_id,
                "namespace": namespace_name,
                "title": title,
                "redirect": bool(is_redirect),
                "content_model": content_model,
                "revision_id": revision_id,
                "revision_timestamp": revision_timestamp,
                "revision_sha1": revision_sha1,
                "content_format": content_format,
            }
            if file_url:
                record["file"] = {
                    "url": file_url,
                    "mime": file_mime,
                    "size": file_size,
                    "sha1": file_sha1,
                }

            content = wikitext or ""
            fence = markdown_fence(content)
            markdown.write(f"<!-- factorio-wiki-page {json.dumps(record, ensure_ascii=False)} -->\n")
            markdown.write(f"## {title}\n\n")
            markdown.write(f"Source: <{page_url}>\n\n")
            markdown.write(f"{fence}mediawiki\n{content}")
            if content and not content.endswith("\n"):
                markdown.write("\n")
            markdown.write(f"{fence}\n\n")

    temporary_output.replace(output)
    return page_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"SQLite archive path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--markdown-output",
        type=Path,
        default=DEFAULT_MARKDOWN_OUTPUT,
        help=f"single-file Markdown export path (default: {DEFAULT_MARKDOWN_OUTPUT})",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        choices=range(1, 501),
        metavar="1-500",
        help="pages requested per API call (default: 50)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.25,
        help="minimum delay between API calls in seconds (default: 0.25)",
    )
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--retries", type=int, default=6)
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="delete the specified output archive and start again",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.delay < 0 or args.timeout <= 0 or args.retries < 0:
        raise SystemExit("delay and retries must be non-negative; timeout must be positive")

    output = args.output.resolve()
    markdown_output = args.markdown_output.resolve()
    if args.fresh and output.exists():
        output.unlink()
    if args.fresh and markdown_output.exists():
        markdown_output.unlink()
    output.parent.mkdir(parents=True, exist_ok=True)

    client = WikiClient(args.delay, args.timeout, args.retries)
    connection = connect_database(output)
    try:
        site_info = load_site_info(client)
        namespaces = sorted(
            (
                namespace
                for namespace in site_info["namespaces"].values()
                if namespace["id"] >= 0
            ),
            key=lambda namespace: namespace["id"],
        )

        with connection:
            set_metadata(connection, "source", "https://wiki.factorio.com/")
            set_metadata(connection, "api", API_URL)
            set_metadata(connection, "user_agent", USER_AGENT)
            set_metadata(connection, "started_at", utc_now())
            set_metadata(connection, "site_general", site_info["general"])
            set_metadata(connection, "site_statistics_at_start", site_info["statistics"])
            set_metadata(connection, "namespace_aliases", site_info["namespacealiases"])
            set_metadata(connection, "rights_info", site_info.get("rightsinfo", {}))
            set_metadata(
                connection,
                "scope",
                "Current revision source for every page in every non-virtual namespace; "
                "current file metadata, but not binary media or revision history.",
            )
            for namespace in namespaces:
                connection.execute(
                    """
                    INSERT INTO namespaces(namespace_id, name, canonical_name, is_content)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(namespace_id) DO UPDATE SET
                        name = excluded.name,
                        canonical_name = excluded.canonical_name,
                        is_content = excluded.is_content
                    """,
                    (
                        namespace["id"],
                        namespace.get("name", ""),
                        namespace.get("canonical"),
                        int("content" in namespace),
                    ),
                )

        total = 0
        for namespace in namespaces:
            total += scrape_namespace(
                connection,
                client,
                namespace["id"],
                namespace.get("name", ""),
                args.batch_size,
            )

        with connection:
            set_metadata(connection, "completed_at", utc_now())
            set_metadata(connection, "archived_page_count", total)
        connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        exported_count = export_markdown(connection, markdown_output)
        print(f"Archived {total} namespace pages ({exported_count} unique pages) to {output}")
        print(f"Wrote Codex-ready Markdown to {markdown_output}")
        return 0
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
