
import { Tooltip } from "./tooltip.js"

export const PX_WIDTH = 32
export const PX_HEIGHT = 32


// An object representing an icon of an item, recipe, belt, building, or
// whatever else.
//
// Args:
//   obj: The object which this icon will represent. If it provides a
//        renderTooltip() method, this will be used to make a tooltip on the
//        icon available.
//   name: The filename of the image to use. If not provided, defaults to
//         obj.name.
export class Icon {
    constructor(obj, name) {
        if (name === undefined) {
            this.name = obj.name
        } else {
            this.name = name
        }
        this.obj = obj
    }
    // Creates a new <img> node.
    //
    // Args:
    //   size: The width and height of the (square) image, in pixels. If null
    //         or not given, the size will not be set in the markup (and should
    //         probably be set in the style sheet).
    //   suppressTooltip: If true, a tooltip will not be added to this image.
    //   target: The reference node next to which any tooltip will be rendered.
    //           If not provided, defaults to the image itself.
    make(size, suppressTooltip, target) {
        let x = -this.obj.icon_col * PX_WIDTH
        let y = -this.obj.icon_row * PX_HEIGHT
        let img = d3.select(makeEmptyIcon(size))
            .classed("icon", true)
            .style("background", "url(images/sprite-sheet-" + sheetHash + ".png)")
        if (size !== 32) {
            let ratio = size / 32
            x *= ratio
            y *= ratio
            let width = sheetWidth * ratio
            let height = sheetHeight * ratio
            img.style("background-size", `${width}px ${height}px`)
        }
        img.style("background-position", `${x}px ${y}px`)
        if (!suppressTooltip && this.obj.renderTooltip) {
            let self = this
            new Tooltip(img.node(), () => self.obj.renderTooltip(), target)
        } else {
            img.attr("title", this.obj.name)
        }
        img.attr("alt", this.name)
        return img.node()
    }
}

export function makeEmptyIcon(size) {
    let img = d3.create("img")
        .classed("icon", true)
        // Chrome wants the <img> element to have a src attribute, or it will
        // draw a border around it. Cram in this transparent 1x1 pixel image.
        .attr("src", "images/pixel.gif")
    if (size) {
        img.attr("width", size)
            .attr("height", size)
    }
    return img.node()
}

class Sprite {
    constructor(name, col, row) {
        this.name = name
        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this)
    }
}

export let sprites
export let sheetHash
export let sheetWidth
export let sheetHeight

export function getSprites(data) {
    sheetHash = data.sprites.hash
    sheetWidth = data.sprites.width
    sheetHeight = data.sprites.height
    sprites = new Map()
    for (var name in data.sprites.extra) {
        var d = data.sprites.extra[name]
        sprites.set(name, new Sprite(d.name, d.icon_col, d.icon_row))
    }
}
