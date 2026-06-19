import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export const formatCurrency = (value) => {
  const n = Number(value || 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const formatDate = (dateLike) => {
  if (!dateLike) return new Date().toLocaleDateString('pt-BR')
  const raw = String(dateLike)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-')
    return `${d}/${m}/${y}`
  }
  const d = new Date(dateLike)
  return Number.isNaN(d.getTime()) ? new Date().toLocaleDateString('pt-BR') : d.toLocaleDateString('pt-BR')
}

async function getLogoDataUrl() {
  try {
    const response = await fetch('/logo-gift.png')
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generatePurchasePdf(order, items) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  const logo = await getLogoDataUrl()

  if (logo) {
    doc.addImage(logo, 'PNG', margin, 10, 42, 12)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('GIFT EXCELLENCE', margin, 18)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Itens solicitados', margin, 35)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  const meta = []
  if (order?.order_number) meta.push(`Pedido: ${order.order_number}`)
  if (order?.created_at || order?.order_date || order?.date) meta.push(`Data: ${formatDate(order.created_at || order.order_date || order.date)}`)
  if (order?.requester) meta.push(`Solicitante: ${order.requester}`)
  if (meta.length) doc.text(meta.join('  |  '), margin, 42)
  doc.setTextColor(0)

  const body = items.map((item) => [
    item.name || '-',
    item.link || '-',
    item.quantity_text || '-',
    formatCurrency(item.unit_value),
    formatCurrency(item.subtotal)
  ])

  autoTable(doc, {
    startY: meta.length ? 49 : 40,
    head: [['Item', 'Link', 'Quantidade', 'Valor unit.', 'Subtotal']],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.6,
      cellPadding: 3,
      lineColor: [215, 215, 215],
      lineWidth: 0.25,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [238, 238, 238],
      textColor: [20, 20, 20],
      fontStyle: 'normal'
    },
    columnStyles: {
      0: { cellWidth: 39 },
      1: { cellWidth: 61, textColor: [0, 92, 180] },
      2: { cellWidth: 37 },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' }
    }
  })

  const total = items.reduce((acc, item) => acc + Number(item.subtotal || 0), 0)
  const finalY = doc.lastAutoTable.finalY + 8

  doc.setDrawColor(200)
  doc.setFillColor(248, 248, 248)
  doc.rect(margin, finalY, pageWidth - margin * 2, 14, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Total estimado', margin + 3, finalY + 9)
  doc.text(formatCurrency(total), pageWidth - margin - 3, finalY + 9, { align: 'right' })

  if (order?.notes) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Observação: ${order.notes}`, margin, finalY + 24, { maxWidth: pageWidth - margin * 2 })
  }

  doc.save(`${order?.order_number || 'pedido-compra'}.pdf`)
}
