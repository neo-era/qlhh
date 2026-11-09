const test = require('node:test'), assert = require('node:assert');
const W = require('../core/vnwords.js');
test('số tiền bằng chữ (chứng từ Điều 16 LKT)', () => {
  const c = [[0, 'Không đồng'], [5, 'Năm đồng'], [10, 'Mười đồng'], [15, 'Mười lăm đồng'], [21, 'Hai mươi mốt đồng'], [24, 'Hai mươi tư đồng'],
    [25, 'Hai mươi lăm đồng'], [105, 'Một trăm linh năm đồng'], [110, 'Một trăm mười đồng'], [1000000, 'Một triệu đồng'],
    [1005000, 'Một triệu không trăm linh năm nghìn đồng'], [12876471, 'Mười hai triệu tám trăm bảy mươi sáu nghìn bốn trăm bảy mươi mốt đồng'],
    [1000000000, 'Một tỷ đồng'], [2000001000, 'Hai tỷ không trăm linh một nghìn đồng'], [11, 'Mười một đồng'], [-5, 'Âm năm đồng']];
  for (const [n, s] of c) assert.equal(W.money(n), s, String(n));
});
