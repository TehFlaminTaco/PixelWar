const SEED = `${+new Date()}`

window.WIDTH = 960;
window.HEIGHT = WIDTH / (document.body.clientWidth / document.body.clientHeight);//540;

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
function bilinearInterpolate(xfrac, yfrac, sample){
    return lerp(
        lerp(sample(0,0), sample(1,0), xfrac),
        lerp(sample(0,1), sample(1,1), xfrac),
        yfrac
    )
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
let cache = {};
function sample(x, y, octave, seed){
    seed ||= SEED
    const xfrac = x%1;
    const yfrac = y%1;
    const xfloor = x>>>0;
    const yfloor = y>>>0;
    if(xfrac !== 0 || yfrac !== 0){
        return bicubicInterpolate(xfrac, yfrac, (_x,_y)=>sample(_x+xfloor, _y+yfloor, octave, seed))
    }
    let key = `${x},${y},${octave},${seed}`;
    if (key in cache){
        return cache[key];
    }
    let v= (cyrb64(key)[0] / 2**32);
    return cache[key] = (v / octave);
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

function octavesample(x, y, octave, seed, minoctave = 2){
    x /= (minoctave / 2);
    y /= (minoctave / 2);
    let s = sample(x, y, octave, seed);
    while(octave > minoctave){
        octave /= 2;
        x /= 2;
        y /= 2;
        s += sample(x, y, octave, seed);
    }
    return s
}

let MAX_OCTAVES = 128;
let MIN_OCTAVE = 2;
let scalar = 0;
for(let i=MIN_OCTAVE; i<=MAX_OCTAVES; i*=2){
    scalar += 1/i
}
let start = +new Date();
window.heightMap = [];
seed(+new Date());
for(let y=0; y < window.HEIGHT; y++){
    window.heightMap[y] = [];
    for(let x=0; x < window.WIDTH; x++){
        //window.heightMap[y][x] = octavesample(x,y,MAX_OCTAVES, null, MIN_OCTAVE) / scalar*/
        window.heightMap[y][x] = ((fbm(x / 480,y / 480,10,1,2,0.5,2.0) + 1.0) * 0.5) * 0.7+ 0.1;/*octavesample(x,y,MAX_OCTAVES, null, MIN_OCTAVE) / scalar*/
    }
}
console.log(`Took: ${(+new Date()) - start}ms to generate!`)

window.expectedHeightMap = structuredClone(window.heightMap)
