import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let kit = URL(fileURLWithPath: #filePath)
    .standardizedFileURL.resolvingSymlinksInPath().deletingLastPathComponent()
let sources = kit.appendingPathComponent("sources", isDirectory: true)
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

struct RenderError: Error, CustomStringConvertible {
    let description: String

    init(_ description: String) {
        self.description = description
    }
}

func readSource(_ name: String, width: Int, height: Int) throws -> CGImage {
    let url = sources.appendingPathComponent(name)
    guard let file = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(file, 0, nil) else {
        throw RenderError("Cannot read \(url.path)")
    }
    guard image.width == width, image.height == height else {
        throw RenderError("\(name) must be \(width) × \(height) pixels for this layout")
    }
    return image
}

struct Canvas {
    let width: Int
    let height: Int
    let context: CGContext

    init(_ width: Int, _ height: Int) throws {
        self.width = width
        self.height = height
        guard let bitmap = CGContext(
            data: nil, width: width, height: height, bitsPerComponent: 8,
            bytesPerRow: width * 4, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ) else {
            throw RenderError("Cannot create a \(width) × \(height) canvas")
        }
        context = bitmap
        context.interpolationQuality = .high
    }

    // Layout coordinates are in pixels measured from the top left of the artwork.
    func rect(_ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ height: CGFloat) -> CGRect {
        CGRect(x: x, y: CGFloat(self.height) - y - height, width: width, height: height)
    }

    func background(
        _ image: CGImage,
        fromX: [CGFloat], fromY: [CGFloat], toX: [CGFloat], toY: [CGFloat]
    ) {
        // Fit the bell and dial in the central tile. Extend the surrounding paper layers to the edges.
        for row in 0..<(fromY.count - 1) {
            for column in 0..<(fromX.count - 1) {
                let width = toX[column + 1] - toX[column]
                let height = toY[row + 1] - toY[row]
                let scaleX = width / (fromX[column + 1] - fromX[column])
                let scaleY = height / (fromY[row + 1] - fromY[row])
                context.saveGState()
                context.clip(to: rect(toX[column], toY[row], width, height))
                context.draw(image, in: rect(
                    toX[column] - fromX[column] * scaleX, toY[row] - fromY[row] * scaleY,
                    CGFloat(image.width) * scaleX, CGFloat(image.height) * scaleY
                ))
                context.restoreGState()
            }
        }
    }

    func write(to url: URL) throws {
        let data = NSMutableData()
        guard let image = context.makeImage(),
              let file = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else {
            throw RenderError("Cannot create \(url.lastPathComponent)")
        }
        CGImageDestinationAddImage(file, image, nil)
        guard CGImageDestinationFinalize(file) else {
            throw RenderError("Cannot encode \(url.lastPathComponent)")
        }
        try (data as Data).write(to: url, options: .atomic)
        print("\(url.path) (\(width) × \(height))")
    }
}

func render(to destination: URL) throws {
    let nightToDawn = try readSource("header-source.png", width: 1914, height: 822)
    let backdrop = try readSource("search-source.png", width: 1536, height: 1024)
    let locales = ["en-US", "zh-CN"]
    let cards = try locales.map { try readSource("native-next-alarm-\($0).png", width: 1236, height: 992) }
    try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)

    let header = try Canvas(3840, 1646)
    header.background(
        nightToDawn, fromX: [0, 700, 1214, 1914], fromY: [0, 198, 626, 822],
        toX: [0, 1430, 2407, 3840], toY: [0, 416, 1229, 1646]
    )
    try header.write(to: destination.appendingPathComponent("rosterwake-header.png"))

    for (locale, card) in zip(locales, cards) {
        let canvas = try Canvas(3840, 2560)
        canvas.background(
            backdrop, fromX: [0, 220, 1320, 1536], fromY: [0, 276, 762, 1024],
            toX: [0, 763, 3337, 3840], toY: [0, 706, 1843, 2560]
        )
        let cardWidth: CGFloat = 1144
        let cardHeight = cardWidth * CGFloat(card.height) / CGFloat(card.width)
        let frame = canvas.rect(1828, 1280 - cardHeight / 2, cardWidth, cardHeight)
        canvas.context.saveGState()
        canvas.context.setShadow(
            offset: CGSize(width: 0, height: -14), blur: 34,
            color: CGColor(srgbRed: 0.012, green: 0.031, blue: 0.077, alpha: 0.37)
        )
        canvas.context.draw(card, in: frame)
        canvas.context.restoreGState()
        try canvas.write(to: destination.appendingPathComponent("rosterwake-search-\(locale).png"))
    }
}

let args = Array(CommandLine.arguments.dropFirst())
let usage = "Usage: swift Render.swift [--output DIRECTORY]"
if args == ["--help"] || args == ["-h"] {
    print(usage)
    exit(0)
}
let destination: URL
switch args.count {
case 0:
    let repository = kit.deletingLastPathComponent().deletingLastPathComponent()
    destination = repository.appendingPathComponent("docs/store-launch/app-store-creative", isDirectory: true)
case 2 where args[0] == "--output" && !args[1].isEmpty:
    destination = URL(fileURLWithPath: args[1], isDirectory: true).standardizedFileURL
default:
    FileHandle.standardError.write(Data((usage + "\n").utf8))
    exit(64)
}
do {
    try render(to: destination)
} catch {
    FileHandle.standardError.write(Data(("\(error)\n").utf8))
    exit(1)
}
