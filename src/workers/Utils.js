export const SetPixel = (imageData, color, x, y) => {
  if(x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) {
    return;
  }

  let i = y * imageData.width + x;
  i *= 4;

  if(i + 3 >= imageData.data.length){
    return;
  }

  if(color.priority || !(imageData.data[i] || imageData.data[i+1] || imageData.data[i+2] || imageData.data[i+3])) {
    imageData.data[i] = color.r;
    imageData.data[i + 1] = color.g;
    imageData.data[i + 2] = color.b;
    imageData.data[i + 3] = color.a;
  }
};

const PlotLow = (x0, y0, x1, y1) => {
  let points = [];

  const dx = x1 - x0;
  let dy = y1 - y0;

  let yi = 1;
  if(dy < 0) {
    yi = -1;
    dy = -dy;
  }

  let d = 2 * dy - dx;
  let y = y0;

  for(let x = x0; x <= x1; x++) {
    points.push([x, y]);

    if(d > 0) {
      y = y + yi;
      d = d - 2 * dx;
    }

    d = d + 2 * dy;
  }

  return points;
};

const PlotHigh = (x0, y0, x1, y1) => {
  let points = [];

  let dx = x1 - x0;
  const dy = y1 - y0;

  let xi = 1;
  if(dx < 0) {
    xi = -1;
    dx = -dx;
  }

  let d = 2 * dx - dy;
  let x = x0;

  for(let y = y0; y <= y1; y++) {
    points.push([x, y]);

    if(d > 0) {
      x = x + xi;
      d = d - 2 * dy;
    }

    d = d + 2 * dx;
  }

  return points;
};

// Bresenham's line algorithm
export const Line = (imageData, color, x0, y0, x1, y1) => {
  let points = [];

  if(Math.abs(y1 - y0) < Math.abs(x1 - x0)) {
    if(x0 > x1) {
      points = PlotLow(x1, y1, x0, y0);
    } else {
      points = PlotLow(x0, y0, x1, y1);
    }
  } else {
    if(y0 > y1) {
      points = PlotHigh(x1, y1, x0, y0);
    } else {
      points = PlotHigh(x0, y0, x1, y1);
    }
  }

  points.map(point => SetPixel(imageData, color, point[0], point[1]));
};

export const FilledRect = (imageData, color, sx, sy, ex, ey) => {
  for(let x = sx; x <= ex; x++) {
    for(let y = sy; y <= ey; y++) {
      SetPixel(imageData, color, x, y);
    }
  }
};

export const Rect = (imageData, x, y, width, height, color) => {
  Line(imageData, color, x, y, x + width, y);
  Line(imageData, color, x + width, y, x + width, y + height);
  Line(imageData, color, x, y, x, y + height);
  Line(imageData, color, x, y + height, x + width, y + height);
};
