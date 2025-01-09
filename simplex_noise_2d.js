/**
 * Simplex noise
 *
 * This JavaScript implementation is based on the speed-improved Java version
 * 2012-03-09 by Stefan Gustavson (original Java source code in the public domain).
 *
 * {@link https://web.archive.org/web/20180711022502/http://webstaff.itn.liu.se/~stegu/simplexnoise/SimplexNoise.java}:
 * - Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * - Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * - Better rank ordering method by Stefan Gustavson in 2012.
 */
const tableSize = 512;

var perm = new Uint8Array(tableSize);
var permMod12 = new Uint8Array(tableSize);

// Skewing and unskewing factors for 2 dimensions
const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

/**
 * Fractal/Fractional Brownian Motion (fBm) summation of 2D Perlin Simplex noise.
 *
 * References:
 * {@link https://en.wikipedia.org/wiki/Fractional_Brownian_motion}
 * {@link https://thebookofshaders.com/13/}
 * {@link https://iquilezles.org/articles/fbm/}
 *
 * @param {number} x           - x coordinate
 * @param {number} y           - y coordinate
 * @param {number} octaves     - Number of layers of Simplex noise to combine
 * @param {number} amplitude   - Amplitude ("height") of the first octave of noise
 * @param {number} frequency   - Frequency ("width") of the first octave of noise
 * @param {number} persistence - Persistence is the loss of amplitude between successive octaves
 * @param {number} lacunarity  - Lacunarity specifies the frequency multiplier between successive octaves
 * @returns {number} Noise value in the range[-1; 1], value of 0 on all integer coordinates
 */
const fbm = (x, y, octaves, amplitude, frequency, persistence, lacunarity) => {
    let total = 0;

    for (let i = 0; i < octaves; i++) {
        total += noise(x * frequency, y * frequency) * amplitude; // Get the noise sample
        amplitude *= persistence;
        frequency *= lacunarity;
    }

    return total;
};

/**
 * Helper function to compute gradients-dot-residual vectors (2D).
 *
 * References:
 * {@link https://mrl.cs.nyu.edu/~perlin/noise/}
 *
 * @param {number} hash - Hash value
 * @param {number} x    - x coord of the distance to the corner
 * @param {number} y    - y coord of the distance to the corner
 * @returns {number} Gradient value
 */
const grad = (hash, x, y) => {
    let h = hash & 0x0F;
    let u = h < 8 ? x : y;
    let v = h < 4 ? y : 0;

    return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
};

/**
 * 2D Perlin simplex noise.
 *
 * References:
 * {@link https://web.archive.org/web/20180711022502/http://webstaff.itn.liu.se/~stegu/simplexnoise/SimplexNoise.java}
 *
 * @param {number} x - x coordinate
 * @param {number} y - y coordinate
 * @returns {number} Noise value in the range[-1; 1], value of 0 on all integer coordinates
 */
const noise = (xin, yin) => {
    let n0, n1, n2; // Noise contributions from the three corners

    // Skew the input space to determine which simplex cell we're in
    let s = (xin + yin) * F2; // Hairy factor for 2D
    let i = Math.floor(xin + s);
    let j = Math.floor(yin + s);
    let t = (i + j) * G2;

    // (i - t) Unskew the cell origin back to (x,y) space
    let x0 = xin - (i - t); // The x,y distances from the cell origin
    let y0 = yin - (j - t);

    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    let i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if (x0 > y0) {
        [i1, j1] = [1, 0]; // lower triangle, XY order: (0,0)->(1,0)->(1,1)
    } else {
        [i1, j1] = [0, 1]; // upper triangle, YX order: (0,0)->(0,1)->(1,1)
    }

    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    let x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    let y1 = y0 - j1 + G2;
    let x2 = x0 - 1.0 + 2.0 * G2; // Offsets for last corner in (x,y) unskewed coords
    let y2 = y0 - 1.0 + 2.0 * G2;

    // Work out the hashed gradient indices of the three simplex corners
    i &= 255;
    j &= 255;

    let gi0 = permMod12[i + perm[j]];
    let gi1 = permMod12[i + i1 + perm[j + j1]];
    let gi2 = permMod12[i + 1 + perm[j + 1]];

    // Calculate the contribution from the three corners
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
        n0 = 0.0;
    } else {
        t0 *= t0;
        n0 = t0 * t0 * grad(gi0, x0, y0); // (x,y) of grad used for 2D gradient
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
        n1 = 0.0;
    } else {
        t1 *= t1;
        n1 = t1 * t1 * grad(gi1, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
        n2 = 0.0;
    } else {
        t2 *= t2;
        n2 = t2 * t2 * grad(gi2, x2, y2);
    }

    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70.0 * (n0 + n1 + n2);
};

/**
 * SplitMix32 is a splittable pseudorandom number generator (PRNG).
 *
 * Guy L. Steele, Jr., Doug Lea, and Christine H. Flood. 2014. Fast splittable
 * pseudorandom number generators. In Proceedings of the 2014 ACM International
 * Conference on Object Oriented Programming Systems Languages & Applications
 * (OOPSLA '14). ACM, New York, NY, USA, 453-472.
 * {@link DOI https://doi.org/10.1145/2660193.2660195}
 *
 * References:
 * {@link https://github.com/bryc/code/blob/master/jshash/PRNGs.md#splitmix32}
 * {@link https://github.com/joelkp/ranoise#splitmix32a}
 * {@link https://gee.cs.oswego.edu/dl/papers/oopsla14.pdf}
 * {@link https://github.com/umireon/my-random-stuff/blob/master/xorshift/splitmix32.c}
 *
 * @param {number} a - Seed value for SplitMix32
 * @returns {function}
 */
const splitmix32 = a => {
    return () => {
        a |= 0; a = a + 0x9e3779b9 | 0;
        var t = a ^ a >>> 16; t = Math.imul(t, 0x21f0aaad);
        t = t ^ t >>> 15; t = Math.imul(t, 0x735a2d97);
        return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
    };
};

/**
 * Builds a random permutation table.
 *
 * @param {number} seed - Seed value for SplitMix32
 * @returns {void}
 */
const seed = seed => {
    const random = splitmix32(seed);

    let p = new Uint8Array(tableSize);

    for (let i = 0; i < tableSize / 2; i++) {
        p[i] = i;
    }

    for (let i = 0; i < tableSize / 2 - 1; i++) {
        let r = i + ~~(random() * (256 - i));
        [p[r], p[i]] = [p[i], p[r]];
    }

    for (let i = 0; i < tableSize; i++) {
        perm[i] = p[i & 255];
        permMod12[i] = perm[i] % 12;
    }
};
