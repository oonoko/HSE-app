import JSZip from 'jszip'

// ExcelJS can't write chart objects, so after it produces the workbook we add
// native DrawingML charts to the zip (same part layout openpyxl/Excel write).

export type ChartSpec = {
  type: 'pie' | 'bar'
  title: string
  seriesName: string
  /** Sheet the data lives on and the A1 ranges (no sheet prefix), e.g. "$A$5:$A$9". */
  sheet: string
  categoryRange: string
  valueRange: string
  categories: string[]
  values: number[]
  /** Top-left anchor (zero based) and size in cells. */
  anchor: { col: number; row: number; cols: number; rows: number }
  /** Per point hex colours (pie slices / bar fill). */
  colors?: string[]
  /** Fixed 0-100 value axis for percentages. */
  percentAxis?: boolean
}

const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'

function esc(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function ref(sheet: string, range: string) {
  return `'${sheet.replace(/'/g, "''")}'!${range}`
}

function fill(hex: string) {
  return `<c:spPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></c:spPr>`
}

function titleXml(text: string) {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="mn-MN" sz="1200" b="1"/><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
}

function seriesXml(spec: ChartSpec) {
  const catCache = `<c:strCache><c:ptCount val="${spec.categories.length}"/>${spec.categories.map((label, i) => `<c:pt idx="${i}"><c:v>${esc(label)}</c:v></c:pt>`).join('')}</c:strCache>`
  const valCache = `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${spec.values.length}"/>${spec.values.map((value, i) => `<c:pt idx="${i}"><c:v>${value}</c:v></c:pt>`).join('')}</c:numCache>`
  const points = spec.type === 'pie' && spec.colors
    ? spec.colors.slice(0, spec.values.length).map((hex, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/>${fill(hex)}</c:dPt>`).join('')
    : ''
  const barFill = spec.type === 'bar' && spec.colors?.[0] ? fill(spec.colors[0]) : ''
  const labels = `<c:dLbls><c:spPr><a:noFill/></c:spPr><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
  return `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${esc(spec.seriesName)}</c:v></c:tx>${barFill}${spec.type === 'bar' ? '<c:invertIfNegative val="0"/>' : ''}${points}${labels}<c:cat><c:strRef><c:f>${esc(ref(spec.sheet, spec.categoryRange))}</c:f>${catCache}</c:strRef></c:cat><c:val><c:numRef><c:f>${esc(ref(spec.sheet, spec.valueRange))}</c:f>${valCache}</c:numRef></c:val></c:ser>`
}

export function chartXml(spec: ChartSpec) {
  const plot = spec.type === 'pie'
    ? `<c:pieChart><c:varyColors val="1"/>${seriesXml(spec)}<c:firstSliceAng val="0"/></c:pieChart>`
    : `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${seriesXml(spec)}<c:gapWidth val="80"/><c:axId val="111111"/><c:axId val="222222"/></c:barChart>` +
      `<c:catAx><c:axId val="111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="222222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
      `<c:valAx><c:axId val="222222"/><c:scaling><c:orientation val="minMax"/>${spec.percentAxis ? '<c:max val="100"/><c:min val="0"/>' : ''}</c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="111111"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`
  const legend = spec.type === 'pie' ? '<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>' : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart>${titleXml(spec.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`
}

function drawingXml(specs: ChartSpec[]) {
  const anchors = specs.map((spec, i) => {
    const { col, row, cols, rows } = spec.anchor
    return `<xdr:twoCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${col + cols}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + rows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}">${anchors}</xdr:wsDr>`
}

async function sheetPathFor(zip: JSZip, sheetName: string): Promise<string> {
  const workbook = await zip.file('xl/workbook.xml')!.async('string')
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string')
  const sheetTag = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map(match => match[0]).find(tag => {
    const name = /name="([^"]*)"/.exec(tag)?.[1]
    return name !== undefined && name.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') === sheetName
  })
  if (!sheetTag) throw new Error(`Sheet not found: ${sheetName}`)
  const rid = /r:id="([^"]*)"/.exec(sheetTag)![1]
  const relTag = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(match => match[0]).find(tag => new RegExp(`Id="${rid}"`).test(tag))
  const target = /Target="([^"]*)"/.exec(relTag ?? '')?.[1]
  if (!target) throw new Error(`Relationship not found for ${sheetName}`)
  return target.startsWith('/') ? target.slice(1) : `xl/${target}`
}

export async function addChartsToWorkbook(buffer: Buffer | ArrayBuffer | Uint8Array, sheetName: string, specs: ChartSpec[]): Promise<Buffer> {
  if (specs.length === 0) return Buffer.from(buffer as Buffer)
  const zip = await JSZip.loadAsync(buffer)
  const sheetPath = await sheetPathFor(zip, sheetName)
  const sheetFile = sheetPath.split('/').pop()!

  const drawingName = 'drawing1.xml'
  specs.forEach((spec, i) => zip.file(`xl/charts/chart${i + 1}.xml`, chartXml(spec)))
  zip.file(`xl/drawings/${drawingName}`, drawingXml(specs))
  zip.file(
    `xl/drawings/_rels/${drawingName}.rels`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${specs.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/chart" Target="../charts/chart${i + 1}.xml"/>`).join('')}</Relationships>`,
  )

  const relsPath = `xl/worksheets/_rels/${sheetFile}.rels`
  const existingRels = zip.file(relsPath)
  const drawingRelId = 'rIdChartDrawing'
  const drawingRel = `<Relationship Id="${drawingRelId}" Type="${NS_R}/drawing" Target="../drawings/${drawingName}"/>`
  if (existingRels) {
    const xml = await existingRels.async('string')
    zip.file(relsPath, xml.replace('</Relationships>', `${drawingRel}</Relationships>`))
  } else {
    zip.file(relsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRel}</Relationships>`)
  }

  let sheetXml = await zip.file(sheetPath)!.async('string')
  if (!/xmlns:r=/.test(sheetXml.slice(0, 600))) sheetXml = sheetXml.replace(/<worksheet\b/, `<worksheet xmlns:r="${NS_R}"`)
  const drawingTag = `<drawing r:id="${drawingRelId}"/>`
  const trailing = sheetXml.search(/<(legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/)
  sheetXml = trailing >= 0 ? sheetXml.slice(0, trailing) + drawingTag + sheetXml.slice(trailing) : sheetXml.replace('</worksheet>', `${drawingTag}</worksheet>`)
  zip.file(sheetPath, sheetXml)

  let contentTypes = await zip.file('[Content_Types].xml')!.async('string')
  const overrides = [
    `<Override PartName="/xl/drawings/${drawingName}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    ...specs.map((_, i) => `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`),
  ]
  contentTypes = contentTypes.replace('</Types>', `${overrides.join('')}</Types>`)
  zip.file('[Content_Types].xml', contentTypes)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
