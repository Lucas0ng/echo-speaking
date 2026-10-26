'use strict';

(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 300;

  function el(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function dayOf(x) {
    const d = String(x).split('-');
    return Date.UTC(Number(d[0]), Number(d[1]) - 1, Number(d[2])) / 86400000;
  }

  function mmdd(x) { return String(x).slice(5); }

  window.lineChart = function (points, opts) {
    points = Array.isArray(points) ? points : [];
    opts = opts || {};
    const h = Number(opts.height) || 120;
    const digits = Number.isInteger(opts.digits) ? opts.digits : 0;
    const unit = opts.unit == null ? '' : String(opts.unit);
    const svg = el('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + h, width: '100%' });

    if (!points.length) {
      const empty = el('text', {
        class: 'chart-text', x: W / 2, y: h / 2 + 4, 'text-anchor': 'middle'
      });
      empty.textContent = '还没有数据';
      svg.appendChild(empty);
      return svg;
    }

    const top = 22, bottom = h - 24, left = 18, right = W - 18;
    const days = points.map(function (p) { return dayOf(p.x); });
    const vals = points.map(function (p) { return Number(p.y); });
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    } else {
      const pad = (hi - lo) * 0.15;
      lo -= pad;
      hi += pad;
    }

    const span = days[days.length - 1] - days[0];
    const coords = points.map(function (p, i) {
      const x = points.length === 1 || span === 0
        ? W / 2
        : left + (days[i] - days[0]) / span * (right - left);
      const y = top + (hi - vals[i]) / (hi - lo) * (bottom - top);
      return { x: x, y: y };
    });

    if (points.length > 1) {
      svg.appendChild(el('polyline', {
        class: 'chart-line',
        points: coords.map(function (c) { return c.x + ',' + c.y; }).join(' ')
      }));
    }

    points.forEach(function (p, i) {
      const last = i === points.length - 1;
      const dot = el('circle', {
        class: last ? 'chart-dot last' : 'chart-dot',
        cx: coords[i].x, cy: coords[i].y, r: last ? 5 : 3.5
      });
      const title = document.createElementNS(NS, 'title');
      title.textContent = mmdd(p.x) + '：' + vals[i].toFixed(digits) +
        (unit ? ' ' + unit : '') + (p.label ? ' · ' + p.label : '');
      dot.appendChild(title);
      svg.appendChild(dot);
    });

    function addValue(x, y, value, cls, anchor) {
      const t = el('text', { class: cls, x: x, y: y, 'text-anchor': anchor });
      t.textContent = value;
      svg.appendChild(t);
    }

    const first = coords[0], latest = coords[coords.length - 1];
    if (points.length === 1) {
      addValue(first.x, first.y - 10, vals[0].toFixed(digits), 'chart-text strong', 'middle');
    } else {
      addValue(first.x + 8, first.y - 9, vals[0].toFixed(digits), 'chart-text', 'start');
      addValue(latest.x - 8, latest.y - 9, vals[vals.length - 1].toFixed(digits), 'chart-text strong', 'end');
    }

    const firstDate = el('text', { class: 'chart-text', x: 6, y: h - 5, 'text-anchor': 'start' });
    firstDate.textContent = mmdd(points[0].x);
    const lastDate = el('text', { class: 'chart-text', x: W - 6, y: h - 5, 'text-anchor': 'end' });
    lastDate.textContent = mmdd(points[points.length - 1].x);
    svg.appendChild(firstDate);
    svg.appendChild(lastDate);
    return svg;
  };
})();

/*
.chart { display: block; width: 100%; height: auto; }
.chart-line { fill: none; stroke: var(--good); stroke-width: 2; }
.chart-dot { fill: var(--surface); stroke: var(--good); stroke-width: 2; }
.chart-dot.last { fill: var(--good); }
.chart-text { fill: var(--muted); font-size: 12px; }
.chart-text.strong { fill: var(--ink); font-weight: 600; font-size: 13px; }
*/
