"use client";
import React, { useState, useMemo } from 'react';

interface GstReturnTabProps {
  currentShop: any;
  shopGstNumber: string;
  counterBills: any[];
  onlineOrders: any[];
  extractBillDetails: (bill: any) => any;
}

export default function GstReturnTab({
  currentShop,
  shopGstNumber,
  counterBills,
  onlineOrders,
  extractBillDetails
}: GstReturnTabProps) {
  const now = new Date();
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0 - 11
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>(() => {
    const m = now.getMonth();
    if (m >= 3 && m <= 5) return 'Q1'; // Apr-Jun
    if (m >= 6 && m <= 8) return 'Q2'; // Jul-Sep
    if (m >= 9 && m <= 11) return 'Q3'; // Oct-Dec
    return 'Q4'; // Jan-Mar
  });

  const [sourceFilter, setSourceFilter] = useState<'both' | 'counter' | 'online'>('both');
  const [onlyGstBills, setOnlyGstBills] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'summary' | 'b2b' | 'b2c'>('summary');

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const activeShopGst = (shopGstNumber || currentShop?.gst_no || currentShop?.gstin || '').trim().toUpperCase();

  // 1. Combine & Normalize Counter + Online Bills
  const normalizedAllBills = useMemo(() => {
    const cList = (counterBills || []).map(b => ({ ...b, _source: 'Counter POS' }));
    const oList = (onlineOrders || []).map(o => ({ ...o, _source: 'Online App' }));

    let combined =
      sourceFilter === 'counter' ? cList :
      sourceFilter === 'online' ? oList :
      [...cList, ...oList];

    return combined
      .map(bill => {
        const d = extractBillDetails(bill);
        const created = new Date(bill.created_at || Date.now());
        const taxableValue = Math.max(0, d.subTotalVal - d.discountVal);
        const gstRate = d.isGstVal ? Number(d.gstRateVal || 18) : 0;
        const gstAmt = d.isGstVal ? Number(d.gstAmtVal || 0) : 0;
        const cgst = Number((gstAmt / 2).toFixed(2));
        const sgst = Number((gstAmt / 2).toFixed(2));
        const custGst = String(d.custGstVal || '').trim().toUpperCase();

        return {
          raw: bill,
          billNo: String(bill.bill_no || bill.order_no || bill.billNo || bill.id),
          dateObj: created,
          dateStr: created.toLocaleDateString('en-IN'),
          source: bill._source,
          customerName: bill.customer_name || bill.custName || 'Walk-in Customer',
          customerPhone: bill.customer_phone || bill.phone || bill.custPhone || '',
          customerGst: custGst,
          type: custGst.length >= 15 ? 'B2B' : 'B2C',
          isGstBill: Boolean(d.isGstVal || gstAmt > 0),
          taxableValue,
          gstRate,
          cgst,
          sgst,
          totalGst: gstAmt,
          invoiceValue: Number(d.totalVal || 0)
        };
      })
      .filter(row => {
        // Period Filter
        const y = row.dateObj.getFullYear();
        const m = row.dateObj.getMonth();
        let matchPeriod = false;

        if (periodType === 'monthly') {
          matchPeriod = y === selectedYear && m === selectedMonth;
        } else {
          if (selectedQuarter === 'Q1') matchPeriod = y === selectedYear && m >= 3 && m <= 5;
          else if (selectedQuarter === 'Q2') matchPeriod = y === selectedYear && m >= 6 && m <= 8;
          else if (selectedQuarter === 'Q3') matchPeriod = y === selectedYear && m >= 9 && m <= 11;
          else if (selectedQuarter === 'Q4') matchPeriod = y === selectedYear && m >= 0 && m <= 2;
        }

        const matchGst = onlyGstBills ? row.isGstBill : true;
        return matchPeriod && matchGst;
      })
      .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [counterBills, onlineOrders, sourceFilter, periodType, selectedYear, selectedMonth, selectedQuarter, onlyGstBills]);

  // 2. Metrics & Rate-Wise Breakdown (For GSTR-1 & GSTR-3B)
  const gstMetrics = useMemo(() => {
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalGst = 0;
    let totalInvoiceVal = 0;
    let b2bCount = 0;
    let b2cCount = 0;

    const rateMap = new Map<number, { rate: number; count: number; taxable: number; cgst: number; sgst: number; totalGst: number; invoiceVal: number }>();

    normalizedAllBills.forEach(b => {
      totalTaxable += b.taxableValue;
      totalCgst += b.cgst;
      totalSgst += b.sgst;
      totalGst += b.totalGst;
      totalInvoiceVal += b.invoiceValue;
      if (b.type === 'B2B') b2bCount++;
      else b2cCount++;

      const prev = rateMap.get(b.gstRate) || {
        rate: b.gstRate,
        count: 0,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        totalGst: 0,
        invoiceVal: 0
      };
      prev.count += 1;
      prev.taxable += b.taxableValue;
      prev.cgst += b.cgst;
      prev.sgst += b.sgst;
      prev.totalGst += b.totalGst;
      prev.invoiceVal += b.invoiceValue;
      rateMap.set(b.gstRate, prev);
    });

    return {
      totalTaxable: Number(totalTaxable.toFixed(2)),
      totalCgst: Number(totalCgst.toFixed(2)),
      totalSgst: Number(totalSgst.toFixed(2)),
      totalGst: Number(totalGst.toFixed(2)),
      totalInvoiceVal: Number(totalInvoiceVal.toFixed(2)),
      b2bCount,
      b2cCount,
      rateSummary: Array.from(rateMap.values()).sort((a, b) => a.rate - b.rate)
    };
  }, [normalizedAllBills]);

  const periodLabel =
    periodType === 'monthly'
      ? `${monthsList[selectedMonth]}_${selectedYear}`
      : `${selectedQuarter}_${selectedYear}`;

  // ==========================================
  // 📥 1. EXPORT GSTR-1 EXCEL (CSV) FOR CA / PORTAL
  // ==========================================
  const exportGstr1Csv = () => {
    if (normalizedAllBills.length === 0) return alert('इस अवधि में कोई बिल नहीं मिला!');

    const rows: string[] = [];
    rows.push(`"GSTR-1 SALES RETURN REPORT","${currentShop?.name || 'SHOP'}"`);
    rows.push(`"Shop GSTIN","${activeShopGst || 'NOT SET'}","Period","${periodLabel}"`);
    rows.push(`"Total Invoices","${normalizedAllBills.length}","Total Taxable","${gstMetrics.totalTaxable}","Total CGST","${gstMetrics.totalCgst}","Total SGST","${gstMetrics.totalSgst}","Total GST","${gstMetrics.totalGst}","Total Invoice Value","${gstMetrics.totalInvoiceVal}"`);
    rows.push('');

    // Invoice-wise Sheet
    rows.push('"Invoice No","Invoice Date","Source","Return Type (B2B/B2C)","Customer Name","Buyer GSTIN","Taxable Value (Rs)","GST Rate (%)","CGST (Rs)","SGST (Rs)","Total GST (Rs)","Invoice Total (Rs)"');
    normalizedAllBills.forEach(b => {
      rows.push([
        `"${b.billNo}"`,
        `"${b.dateStr}"`,
        `"${b.source}"`,
        `"${b.type}"`,
        `"${b.customerName.replace(/"/g, '""')}"`,
        `"${b.customerGst}"`,
        `"${b.taxableValue}"`,
        `"${b.gstRate}%"`,
        `"${b.cgst}"`,
        `"${b.sgst}"`,
        `"${b.totalGst}"`,
        `"${b.invoiceValue}"`
      ].join(','));
    });

    rows.push('');
    rows.push('"--- GST RATE-WISE SUMMARY (FOR GSTR-1 & GSTR-3B) ---"');
    rows.push('"GST Rate (%)","Total Bills","Taxable Value (Rs)","CGST (Rs)","SGST (Rs)","Total GST (Rs)","Total Invoice Value (Rs)"');
    gstMetrics.rateSummary.forEach(r => {
      rows.push([`"${r.rate}%"`, `"${r.count}"`, `"${r.taxable.toFixed(2)}"`, `"${r.cgst.toFixed(2)}"`, `"${r.sgst.toFixed(2)}"`, `"${r.totalGst.toFixed(2)}"`, `"${r.invoiceVal.toFixed(2)}"`].join(','));
    });

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${activeShopGst || 'SHOP'}_${periodLabel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ==========================================
  // 🏛️ 2. EXPORT GST PORTAL JSON (GSTR-1 FORMAT)
  // ==========================================
  const exportGstPortalJson = () => {
    if (normalizedAllBills.length === 0) return alert('इस अवधि में कोई बिल नहीं मिला!');

    const fpMonth = String(selectedMonth + 1).padStart(2, '0');
    const fp = `${fpMonth}${selectedYear}`; // MMYYYY format required by GST Portal

    const b2bInvoices = normalizedAllBills
      .filter(b => b.type === 'B2B')
      .map(b => ({
        ctin: b.customerGst,
        inv: [
          {
            inum: b.billNo,
            idt: b.dateObj.toLocaleDateString('en-GB').replace(/\//g, '-'),
            val: b.invoiceValue,
            pos: activeShopGst ? activeShopGst.slice(0, 2) : '10',
            rchrg: 'N',
            inv_typ: 'R',
            itms: [
              {
                num: 1,
                itm_det: {
                  txval: b.taxableValue,
                  rt: b.gstRate,
                  camt: b.cgst,
                  samt: b.sgst
                }
              }
            ]
          }
        ]
      }));

    // B2CS (Small B2C grouped by Rate)
    const b2cRateMap = new Map<number, { txval: number; camt: number; samt: number }>();
    normalizedAllBills
      .filter(b => b.type === 'B2C')
      .forEach(b => {
        const prev = b2cRateMap.get(b.gstRate) || { txval: 0, camt: 0, samt: 0 };
        prev.txval += b.taxableValue;
        prev.camt += b.cgst;
        prev.samt += b.sgst;
        b2cRateMap.set(b.gstRate, prev);
      });

    const b2cs = Array.from(b2cRateMap.entries()).map(([rt, v]) => ({
      sply_ty: 'INTRA',
      pos: activeShopGst ? activeShopGst.slice(0, 2) : '10',
      typ: 'OE',
      rt,
      txval: Number(v.txval.toFixed(2)),
      camt: Number(v.camt.toFixed(2)),
      samt: Number(v.samt.toFixed(2))
    }));

    const gstr1Json = {
      gstin: activeShopGst || '10ABCDE1234F1Z5',
      fp,
      gt: gstMetrics.totalInvoiceVal,
      cur_gt: gstMetrics.totalInvoiceVal,
      b2b: b2bInvoices,
      b2cs
    };

    const blob = new Blob([JSON.stringify(gstr1Json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_PORTAL_${activeShopGst || 'SHOP'}_${periodLabel}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ==========================================
  // 📄 3. EXPORT PRINTABLE PDF FOR CA FILING
  // ==========================================
  const exportGstPdf = () => {
    const win = window.open('', '_blank', 'width=960,height=850');
    if (!win) return window.print();

    const rateRowsHtml = gstMetrics.rateSummary
      .map(
        r => `
        <tr>
          <td><strong>${r.rate}% GST</strong></td>
          <td style="text-align:center;">${r.count}</td>
          <td style="text-align:right;">₹${r.taxable.toFixed(2)}</td>
          <td style="text-align:right;">₹${r.cgst.toFixed(2)}</td>
          <td style="text-align:right;">₹${r.sgst.toFixed(2)}</td>
          <td style="text-align:right;font-weight:bold;">₹${r.totalGst.toFixed(2)}</td>
          <td style="text-align:right;font-weight:bold;">₹${r.invoiceVal.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const billRowsHtml = normalizedAllBills
      .map(
        (b, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>#${b.billNo}</td>
          <td>${b.dateStr}</td>
          <td>${b.source}</td>
          <td>${b.type}</td>
          <td>${b.customerName}${b.customerGst ? `<br/><small>GSTIN: ${b.customerGst}</small>` : ''}</td>
          <td style="text-align:right;">₹${b.taxableValue}</td>
          <td style="text-align:center;">${b.gstRate}%</td>
          <td style="text-align:right;">₹${b.totalGst}</td>
          <td style="text-align:right;font-weight:bold;">₹${b.invoiceValue}</td>
        </tr>`
      )
      .join('');

    win.document.write(`
      <html>
        <head>
          <title>GST Return Report - ${periodLabel}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #111; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
            .card { border: 1px solid #333; padding: 10px; border-radius: 8px; background: #f8fafc; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
            th { background: #e2e8f0; text-align: left; }
          </style>
        </head>
        <body>
          <h2>🏛️ GSTR-1 / GSTR-3B Return Summary — ${currentShop?.name || 'SHOP'}</h2>
          <p><strong>Shop GSTIN:</strong> ${activeShopGst || 'Not Set'} | <strong>Period:</strong> ${periodLabel.replace('_', ' ')} | <strong>Source:</strong> ${sourceFilter.toUpperCase()}</p>
          <div class="grid">
            <div class="card"><strong>Taxable Value</strong><h3>₹${gstMetrics.totalTaxable}</h3></div>
            <div class="card"><strong>CGST + SGST</strong><h3>₹${gstMetrics.totalCgst} + ₹${gstMetrics.totalSgst}</h3></div>
            <div class="card"><strong>Total GST Payable</strong><h3>₹${gstMetrics.totalGst}</h3></div>
            <div class="card"><strong>Total Invoice Value</strong><h3>₹${gstMetrics.totalInvoiceVal}</h3></div>
          </div>
          <h3>📊 GST Rate-Wise Summary (GSTR-3B Ready)</h3>
          <table>
            <thead><tr><th>Rate</th><th>Bills</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>Total GST</th><th>Invoice Total</th></tr></thead>
            <tbody>${rateRowsHtml}</tbody>
          </table>
          <h3 style="margin-top:20px;">🧾 Invoice-Wise Register (${normalizedAllBills.length} Bills)</h3>
          <table>
            <thead><tr><th>#</th><th>Bill No</th><th>Date</th><th>Source</th><th>Type</th><th>Customer</th><th>Taxable</th><th>Rate</th><th>GST</th><th>Total</th></tr></thead>
            <tbody>${billRowsHtml}</tbody>
          </table>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const displayList =
    viewMode === 'b2b'
      ? normalizedAllBills.filter(b => b.type === 'B2B')
      : viewMode === 'b2c'
      ? normalizedAllBills.filter(b => b.type === 'B2C')
      : normalizedAllBills;

  return (
    <div style={{ color: 'white' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f766e, #0f172a)',
          padding: '14px',
          borderRadius: '12px',
          border: '2px solid #14b8a6',
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: '#fff' }}>
            🏛️ GST Return Filing Center (GSTR-1 & GSTR-3B)
          </h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '11.5px', color: '#ccfbf1' }}>
            Counter POS + Online Sales दोनों का Monthly या 3-Month (Quarterly) GST डेटा एक क्लिक में डाउनलोड करें।
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={exportGstr1Csv}
            style={{ background: '#16a34a', color: 'white', border: 'none', padding: '9px 13px', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}
          >
            📥 GSTR-1 Excel (CSV)
          </button>
          <button
            onClick={exportGstPortalJson}
            style={{ background: '#2563eb', color: 'white', border: 'none', padding: '9px 13px', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}
          >
            🏛️ GST Portal JSON
          </button>
          <button
            onClick={exportGstPdf}
            style={{ background: '#dc2626', color: 'white', border: 'none', padding: '9px 13px', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}
          >
            📄 CA Summary PDF
          </button>
        </div>
      </div>

      {/* Period & Source Filters */}
      <div style={{ background: '#0f172a', padding: '12px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '14px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setPeriodType('monthly')}
            style={{ padding: '7px 12px', borderRadius: '8px', border: periodType === 'monthly' ? '2px solid #38bdf8' : '1px solid #475569', background: periodType === 'monthly' ? '#0284c7' : '#1e293b', color: 'white', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}
          >
            📅 Monthly (मासिक)
          </button>
          <button
            onClick={() => setPeriodType('quarterly')}
            style={{ padding: '7px 12px', borderRadius: '8px', border: periodType === 'quarterly' ? '2px solid #38bdf8' : '1px solid #475569', background: periodType === 'quarterly' ? '#0284c7' : '#1e293b', color: 'white', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}
          >
            📆 Quarterly (3 महीने)
          </button>

          {periodType === 'monthly' ? (
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              style={{ padding: '7px 10px', borderRadius: '8px', background: '#1e293b', color: '#fbbf24', border: '1px solid #f59e0b', fontWeight: 'bold', fontSize: '12px' }}
            >
              {monthsList.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          ) : (
            <select
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(e.target.value as any)}
              style={{ padding: '7px 10px', borderRadius: '8px', background: '#1e293b', color: '#fbbf24', border: '1px solid #f59e0b', fontWeight: 'bold', fontSize: '12px' }}
            >
              <option value="Q1">Q1 (Apr - Jun)</option>
              <option value="Q2">Q2 (Jul - Sep)</option>
              <option value="Q3">Q3 (Oct - Dec)</option>
              <option value="Q4">Q4 (Jan - Mar)</option>
            </select>
          )}

          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '7px 10px', borderRadius: '8px', background: '#1e293b', color: 'white', border: '1px solid #475569', fontWeight: 'bold', fontSize: '12px' }}
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value as any)}
            style={{ padding: '7px 10px', borderRadius: '8px', background: '#1e293b', color: '#4ade80', border: '1px solid #22c55e', fontWeight: 'bold', fontSize: '12px' }}
          >
            <option value="both">🏪+🌐 Counter + Online (दोनों)</option>
            <option value="counter">🏪 केवल Counter POS बिल</option>
            <option value="online">🌐 केवल Online App आर्डर</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', color: '#e2e8f0' }}>
            <input
              type="checkbox"
              checked={onlyGstBills}
              onChange={e => setOnlyGstBills(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            सिर्फ GST बिल दिखाएं
          </label>
        </div>
      </div>

      {/* 4 GST KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        <div style={{ background: '#0f172a', padding: '12px', borderRadius: '12px', border: '1px solid #334155', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>📊 Taxable Value (कर योग्य राशि)</div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#38bdf8', margin: '3px 0' }}>₹{gstMetrics.totalTaxable}</div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>कुल बिल: {normalizedAllBills.length} (B2B: {gstMetrics.b2bCount} | B2C: {gstMetrics.b2cCount})</div>
        </div>

        <div style={{ background: '#0f172a', padding: '12px', borderRadius: '12px', border: '1px solid #334155', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>🏛️ CGST + SGST</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#fbbf24', margin: '5px 0' }}>
            ₹{gstMetrics.totalCgst} + ₹{gstMetrics.totalSgst}
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>50% Central + 50% State</div>
        </div>

        <div style={{ background: '#0f172a', padding: '12px', borderRadius: '12px', border: '1px solid #334155', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>💰 Total GST Payable</div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#f87171', margin: '3px 0' }}>₹{gstMetrics.totalGst}</div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>सरकार को देय कुल GST</div>
        </div>

        <div style={{ background: '#0f172a', padding: '12px', borderRadius: '12px', border: '1px solid #334155', borderLeft: '4px solid #22c55e' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>🧾 Total Invoice Value</div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#4ade80', margin: '3px 0' }}>₹{gstMetrics.totalInvoiceVal}</div>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Tax + Charges सहित कुल बिल</div>
        </div>
      </div>

      {/* Rate-wise Summary Table */}
      <div style={{ background: '#0f172a', padding: '14px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '14px', overflowX: 'auto' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '14px' }}>📈 GST Rate-Wise Summary (GSTR-3B के लिए)</h4>
        {gstMetrics.rateSummary.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px', padding: '15px 0' }}>इस अवधि में कोई GST डेटा नहीं मिला।</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>GST Rate</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>Bills</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Taxable (₹)</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>CGST (₹)</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>SGST (₹)</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Total GST (₹)</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Invoice Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {gstMetrics.rateSummary.map(r => (
                <tr key={r.rate} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '8px', fontWeight: '900', color: '#fbbf24' }}>{r.rate}%</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{r.count}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>₹{r.taxable.toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>₹{r.cgst.toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>₹{r.sgst.toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#f87171' }}>₹{r.totalGst.toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: '900', color: '#4ade80' }}>₹{r.invoiceVal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* B2B / B2C Filter & Invoice Register */}
      <div style={{ background: '#0f172a', padding: '14px', borderRadius: '12px', border: '1px solid #334155', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <h4 style={{ margin: 0, color: '#fff', fontSize: '14px' }}>🧾 Invoice-Wise GST Register ({displayList.length})</h4>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'summary', label: `All (${normalizedAllBills.length})` },
              { id: 'b2b', label: `B2B (${gstMetrics.b2bCount})` },
              { id: 'b2c', label: `B2C (${gstMetrics.b2cCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as any)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === tab.id ? '#14b8a6' : '#1e293b',
                  color: viewMode === tab.id ? '#0f172a' : '#cbd5e1',
                  fontWeight: '900',
                  fontSize: '11.5px',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#38bdf8', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Bill No</th>
              <th style={{ padding: '8px' }}>Date</th>
              <th style={{ padding: '8px' }}>Source</th>
              <th style={{ padding: '8px' }}>Type</th>
              <th style={{ padding: '8px' }}>Customer & GSTIN</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Taxable</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>Rate</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>GST</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {displayList.map((b, i) => (
              <tr key={`${b.billNo}_${i}`} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '8px', fontWeight: 'bold' }}>#{b.billNo}</td>
                <td style={{ padding: '8px', color: '#cbd5e1' }}>{b.dateStr}</td>
                <td style={{ padding: '8px' }}>
                  <span style={{ background: b.source === 'Counter POS' ? '#065f46' : '#4c1d95', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                    {b.source}
                  </span>
                </td>
                <td style={{ padding: '8px', fontWeight: 'bold', color: b.type === 'B2B' ? '#fbbf24' : '#94a3b8' }}>{b.type}</td>
                <td style={{ padding: '8px' }}>
                  <div style={{ fontWeight: 'bold' }}>{b.customerName}</div>
                  {b.customerGst && <small style={{ color: '#4ade80' }}>GSTIN: {b.customerGst}</small>}
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>₹{b.taxableValue}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{b.gstRate}%</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#f87171', fontWeight: 'bold' }}>₹{b.totalGst}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#4ade80', fontWeight: '900' }}>₹{b.invoiceValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}