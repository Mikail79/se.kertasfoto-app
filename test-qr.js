import React from 'react'
import { renderToString } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'

const svgString = renderToString(
  React.createElement(QRCodeSVG, {
    value: "https://example.com",
    size: 150,
    bgColor: "white",
    fgColor: "#1a1425",
    level: "M",
    marginSize: 1
  })
)
console.log(svgString.substring(0, 50) + "...")
