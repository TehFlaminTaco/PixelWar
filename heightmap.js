const SEED = `${+new Date()}`

window.WIDTH = 960;
window.HEIGHT = 459;

window.lerp = function(a, b, t){
    return a+t*(b-a)
}

window.cubicInterpolate = function(p, x) {
    return p[1] + 0.5 * x * (p[2] - p[0] + x * (2.0 * p[0] - 5.0 * p[1] + 4.0 * p[2] - p[3] + x * (3.0 * (p[1] - p[2]) + p[3] - p[0])));
}
function bicubicInterpolate(xfrac, yfrac, sample) {
    let arr = [];
    for (let i = -1; i <= 2; i++) {
        let p = [];
        for (let j = -1; j <= 2; j++) {
            p.push(sample(i, j));
        }
        arr.push(cubicInterpolate(p, yfrac));
    }

    return cubicInterpolate(arr, xfrac);
}

const cyrb64 = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for(let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    // For a single 53-bit numeric return value we could return
    // 4294967296 * (2097151 & h2) + (h1 >>> 0);
    // but we instead return the full 64-bit value:
    return [h2>>>0, h1>>>0];
  };

let biggest = 0;
let smallest = 100;
function sample(x, y, octave, seed){
    seed ||= SEED
    const xfrac = x%1;
    const yfrac = y%1;
    const xfloor = Math.floor(x)>>>0;
    const yfloor = Math.floor(y)>>>0;
    if(xfrac !== 0 || yfrac !== 0){
        return bicubicInterpolate(xfrac, yfrac, (_x,_y)=>sample(_x+xfloor, _y+yfloor, octave, seed))
    }
    let v= (cyrb64(`${xfloor},${yfloor},${octave},${seed}`)[0] / 2**32);
    return v / octave;
}

function tryget(x,y){
    while(x < 0) x += WIDTH;
    while(y < 0) y += HEIGHT;
    while(x >= WIDTH) x -= WIDTH;
    while(y >= HEIGHT) y -= HEIGHT;
    return heightMap[y >>> 0][x >>> 0];
}

function tryset(x,y,v){
    while(x < 0) x += WIDTH;
    while(y < 0) y += HEIGHT;
    while(x >= WIDTH) x -= WIDTH;
    while(y >= HEIGHT) y -= HEIGHT;
    heightMap[y>>>0][x>>>0] = v;
}

function octavesample(x, y, octave, seed){
    let s = sample(x, y, octave, seed);
    while(octave > 2){
        octave /= 2;
        x /= 2;
        y /= 2;
        s += sample(x, y, octave, seed);
    }
    return s
}

let big = 0;
let small = 1;
const scalar = (1/2 + 1/4 + 1/8 + 1/16 + 1/32 + 1/64 + 1/128)
let start = +new Date();
window.heightMap = [];
for(let y=0; y < window.HEIGHT; y++){
    window.heightMap[y] = [];
    for(let x=0; x < window.WIDTH; x++){
        window.heightMap[y][x] = octavesample(x,y,128) / scalar
    }
}
console.log(`Took: ${(+new Date()) - start}ms to generate!`)

window.expectedHeightMap = structuredClone(window.heightMap)