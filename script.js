const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");

const pop = document.querySelector("img");
const POP_FRAMES = 13;

//window.WIDTH = 64;//document.body.clientWidth;
//window.HEIGHT = document.body.clientHeight;


window.WATER_HEIGHT = 0.5;
window.drainTo = WATER_HEIGHT;
const SAND_HEIGHT = 0.55;
const DIRT_HEIGHT = 0.1;

window.STEEP_PENALTY_SCALE = 32;
window.SLOPE_PENALTY_SCALE = 512;

canvas.width = WIDTH;
canvas.height = HEIGHT;

const MAX_WALK = 4.0;

// We prefer to go downhill where possible, but REALLY hate going up or downsteep cliffs
// And ofc we can't enter water.
function SCORE(x1, y1, x2, y2){
    const end = tryget(x2,y2);
    if(x2 < 0 || x2 >= WIDTH || y2 < 0 || y2 >= HEIGHT) return Infinity;
    if(end < WATER_HEIGHT) return Infinity;
    const start = tryget(x1,y1);
    const steepPenalty = (STEEP_PENALTY_SCALE*(end - start)) ** 4
    const sandPenalty = end < SAND_HEIGHT ? 1.0 : 0.0;
    const diagPenalty = Math.sqrt((x2-x1)**2 + (y2-y1)**2)
    return ((SLOPE_PENALTY_SCALE * (end - start)) + steepPenalty + sandPenalty) * diagPenalty;
}
window.DISTANCE_FACTOR = 1.0;
function path(x1, y1, x2, y2, maxUptime = 3000){
    const options = [{x: x1,y: y1, score: 0, path: []}];
    const explored = new Map();
    explored.set(`${x1>>>0},${y1>>>0}`,0);
    let challenge = 0;
    let destHeight = tryget(x2,y2);
    if(destHeight < WATER_HEIGHT) return [];
    while(options.length){
        let mindex = 0;
        let minscore = options[0].score + ((x2 - options[0].x)**2 + (y2 - options[0].y)**2) * DISTANCE_FACTOR;
        for(let i=1; i < options.length; i++){
            let nscore = options[i].score + ((x2 - options[i].x)**2 + (y2 - options[i].y)**2) * DISTANCE_FACTOR;
            if(nscore < minscore){
                mindex = i;
                minscore = nscore;
            }
        }
        let min = options.splice(mindex, 1)[0];
        if(challenge++ > maxUptime)return [];//min.path;
        for(let dx = -1; dx <= 1; dx++){
            for (let dy = -1; dy <= 1; dy++){
                if(dx === 0 && dy === 0) continue;
                const nx = min.x + dx;
                const ny = min.y + dy;
                const s = SCORE(min.x, min.y, nx, ny);
                if(s > MAX_WALK)continue;
                let newScore = min.score + s;
                if(explored.has(`${nx>>>0},${ny>>>0}`))continue;
                explored.set(`${nx>>>0},${ny>>>0}`,newScore);
                if(nx === x2 && ny === y2){
                    return min.path.concat([[nx,ny]]);
                }
                options.push({x: nx, y: ny, score: newScore, path: min.path.concat([[nx,ny]])});
            }
        }
    }
    return [];
}

let HQs = {};

class Dude {
    x = 0;
    y = 0;
    team = 0;
    target = [];
    alive = true;
    failCount = 0;
    asleep = 0;
    bulletCooldown = 0;
    walkWait = 0;

    ValidPath(){
        if(this.target.length === 0) return false;
        let l = this.target[0];
        for(let i=1; i < this.target.length; i++){
            if(SCORE(l[0],l[1],this.target[i][0], this.target[i][1]) > MAX_WALK)
                return false;
            l = this.target[i];
        }
        return true;
    }

    draw(){
        if(this.asleep>0)this.asleep--;
        if(!this.ValidPath()){
            if(!this.asleep){
                let tx = (Math.random() * WIDTH)>>>0;
                let ty = (Math.random() * HEIGHT)>>>0
                if(!HQs[this.team]){
                    // Nagivate to a random other dude of our team.
                    let otherDudes = dudes.filter(c=>c.team === this.team);
                    let otherDude = otherDudes[(Math.random() * otherDudes.length)>>>0];
                    do {
                        tx = otherDude.x;
                        ty = otherDude.y;
                        tx += (Math.random()*10-5);
                        ty += (Math.random()*10-5);
                    } while (tryget(tx>>>0,ty>>>0) < WATER_HEIGHT);
                    this.target = path(this.x >>> 0, this.y >>> 0, tx >>> 0, ty >>> 0).slice(0,64);
                    if(this.target.length === 0 && otherDude !== this){
                        if(this.failCount++ > 10){
                            this.alive = false;
                        }
                    }
                }else if(!HQs[1 - this.team] || dudes.filter(c=>c.team === this.team).length < 15 || HQs[1 - this.team].battleCooldown > 0 || HQs[this.team].battleCooldown > 0){
                    let hq = HQs[this.team];
                    tx = hq.x + Math.random() * 128 - 64;
                    ty = hq.y + Math.random() * 128 - 64;
                    this.target = path(this.x >>> 0, this.y >>> 0, tx >>> 0, ty >>> 0);
                }else{
                    let hq = HQs[1 - this.team];
                    tx = hq.x + Math.random() * 64 - 32;
                    ty = hq.y + Math.random() * 64 - 32;
                    this.target = path(this.x >>> 0, this.y >>> 0, tx >>> 0, ty >>> 0);
                }
                this.asleep = (Math.random()*10 + 10)>>>0;
            }
        }
        if(this.bulletCooldown > 0)this.bulletCooldown--;
        if(HQs[0] && HQs[1]){
            if(this.bulletCooldown <= 0){
                let otherHQ = HQs[(1 - this.team) >>> 0];
                if((otherHQ.x - this.x) ** 2 + (otherHQ.y - this.y) ** 2 < 64){
                    bullets.push(new Bullet(this.x, this.y, otherHQ.x, otherHQ.y));
                    this.target = path(this.x >>> 0, this.y >>> 0, HQs[this.team].x >>> 0, HQs[this.team].y >>> 0);
                    this.bulletCooldown = 20 + (Math.random()*10)>>>0;
                }
                dudes.filter(c=>c.team !== this.team).forEach(c=>{
                    if((c.x - this.x) ** 2 + (c.y - this.y) ** 2 < 64){
                        if(this.bulletCooldown <= 0){
                            bullets.push(new Bullet(this.x, this.y, c.x, c.y));
                            this.target = path(this.x >>> 0, this.y >>> 0, HQs[this.team].x >>> 0, HQs[this.team].y >>> 0).slice(0,64)
                            this.bulletCooldown = 20 + (Math.random()*10)>>>0;
                        }
                    }
                })
                this.bulletCooldown ||= (Math.random()*10)>>>0;
            }
        }
        if(this.target.length > 0){
            if(this.walkWait > 0)
                this.walkWait--;
            else{
                let p = this.target.splice(0,1)[0];
                if(tryget(p[0],p[1]) < WATER_HEIGHT){
                    tryset(p[0],p[1],WATER_HEIGHT);
                    updatePixel(p[0],p[1])
                    updatePixel(p[0]-1,p[1])
                    this.walkWait = 4;
                }
                this.walkWait = Math.min(SCORE(this.x>>>0,this.y>>>0,p[0]>>>0,p[1]>>>0) >>> 0, MAX_WALK);
                this.x = p[0];
                this.y = p[1];
            }
        }
        context.strokeStyle = this.team === 0 ? "rgba(0,0,255,0.5)" : "rgba(255,0,0,0.5)";
        context.beginPath()
        context.moveTo(this.x, this.y);
        for(let p of this.target){
            context.lineTo(p[0],p[1]);
        }
        context.stroke();
        context.fillStyle = this.team === 0 ? "blue" : "red";
        context.fillRect((this.x>>>0) - 1,(this.y>>>0) - 1,2,2);
    }

    constructor(x,y,team){
        while(tryget(x,y) < WATER_HEIGHT){
            x = Math.random() * WIDTH;
            y = Math.random() * HEIGHT;
        }
        this.x = x;
        this.y = y;
        this.team = team;
        this.target = [];
    }
}

class Explosion {
    x       = 0;
    y       = 0;
    size    = 0;
    frame   = 0;
    draw() {
        if(this.frame >= POP_FRAMES){
            return;
        }
        context.drawImage(pop, 100 * this.frame, 0, 100, 100, (this.x - this.size) >>> 0, (this.y - this.size * 1.05) >>> 0, (this.size * 2) >>> 0, (this.size * 2) >>> 0)
        this.frame++;
    }

    constructor(x, y, size){
        this.x = x;
        this.y = y;
        this.size = size;
    }
}
let explosions = [];

class Bullet {
    x  = 0;
    y  = 0;
    tx = 0;
    ty = 0;
    alive = true;

    draw(){
        let dx = this.tx - this.x;
        let dy = this.ty - this.y;
        let mag = Math.sqrt((dx ** 2) + (dy ** 2));
        if(mag < 0.25){
            explode(this.tx, this.ty, 5);
            this.alive = false;
        }else{
            this.x += dx / mag * 0.25;
            this.y += dy / mag * 0.25;
        }
        context.fillStyle = "yellow";
        context.fillRect(this.x>>>0, this.y>>>0, 2, 2);
    }

    constructor(x,y,tx,ty){
        this.x = x;
        this.y = y;
        this.tx = (tx + Math.random() * 4 - 2) >>> 0;
        this.ty = (ty + Math.random() * 4 - 2) >>> 0;
    }
}
let bullets = [];

let dudes = new Array(50).fill(null).map(c=>new Dude(Math.random() * WIDTH, Math.random() * HEIGHT, Math.random() > 0.5 ? 0 : 1))

const imgData = context.getImageData(0, 0, WIDTH, HEIGHT);
let dirty = true;
function draw(){
    context.putImageData(imgData, 0, 0)
    for(let d of dudes){
        if(tryget(d.x>>>0,d.y>>>0)<WATER_HEIGHT)
            d.alive = false;
    }
    //dudes.filter(c=>!c.alive).map(c=>explode(c.x>>>0,c.y>>>0,5));
    dudes = dudes.filter(c=>c.alive);
    for(let t of [0, 1]){
        let teamDudes = dudes.filter(c=>c.team === t);
        if(!HQs[t]){
            // If all the dudes of this team are within 64u of their average
            let ax = 0;
            let ay = 0;
            if(teamDudes.length === 0)continue;
            for(let d of teamDudes){
                ax += d.x;
                ay += d.y;
            }
            ax /= teamDudes.length;
            ay /= teamDudes.length;
            let allWithin = true;
            for(let d of teamDudes){
                if((ax-d.x)**2 + (ay-d.y)**2 > 64*64){
                    allWithin = false;
                    break;
                }
            }
            if(!allWithin) continue;
            let hx = 0;
            let hy = 0;
            let randomDude = teamDudes[(Math.random()*teamDudes.length)>>>0]
            let tries = 0;
            do {
                hx = (ax + Math.random() * (32 * tries) - (16 * tries)) >>> 0;
                hy = (ay + Math.random() * (32 * tries) - (16 * tries)) >>> 0;
                if(++tries > 10)break;
            }while(((hx - ax)**2 + (hy - ay)**2) > (16 * tries)**2 || tryget(hx,hy) < WATER_HEIGHT || path(hx,hy,randomDude.x>>>0,randomDude.y>>>0).length===0 || (HQs[(1-t)>>>0] && (path(HQs[(1-t)>>>0].x >>> 0, HQs[(1-t)>>>0].y >>> 0, hx >>> 0, hy >>> 0).length === 0 || path(hx >>> 0, hy >>> 0, HQs[(1-t)>>>0].x >>> 0, HQs[(1-t)>>>0].y >>> 0).length === 0)));
            if(tries <= 10){
                HQs[t] = {
                    x: hx >>> 0,
                    y: hy >>> 0,
                    cooldown: 25,
                    battleCooldown: 250
                }
            }
        }else{
            let hq = HQs[t];
            if(HQs[1-t] && hq.battleCooldown > 0)hq.battleCooldown--;
            if(teamDudes.length < 25 && hq.cooldown <= 0){
                dudes.push(new Dude(hq.x, hq.y, t));
                hq.cooldown = 25 + (Math.random() * 50)>>>0;
            }
            if(hq.cooldown > 0)hq.cooldown--;
            context.strokeStyle = "black"
            context.strokeRect(hq.x - 2, hq.y - 2, 4, 4);
            context.fillStyle = t === 0 ? "blue" : "red";
            context.fillRect(hq.x - 2, hq.y - 2, 4, 4);
        }
    }
    bullets = bullets.filter(c=>c.alive);
    for(let b of bullets){
        b.draw();
    }
    for(let d of dudes)
        d.draw();
    explosions = explosions.filter(c=>c.frame < POP_FRAMES);
    for(let e of explosions)
        e.draw();
}

function put(x, y, r, g, b, a){
    const index = (x + y * WIDTH) * 4;
    imgData.data[index + 0] = r;
    imgData.data[index + 1] = g;
    imgData.data[index + 2] = b;
    imgData.data[index + 3] = a;
    dirty = true;
}

function heightLighting(x,y){
    const xfloor = x >>> 0;
    const yfloor = y >>> 0;
    const xplus1 = ((xfloor+1) >= WIDTH) ? 0 : xfloor+1;
    const x0y0 = window.heightMap[yfloor][xfloor]
    const x1y0 = window.heightMap[yfloor][xplus1]
    let delta = (x0y0 - x1y0) * 50;
    return delta + 1;
}

function updatePixel(x,y){
    while(x < 0) x += WIDTH;
    while(y < 0) y += HEIGHT;
    while(x >= WIDTH) x -= WIDTH;
    while(y >= HEIGHT) y -= HEIGHT;
    x >>>= 0;
    y >>>= 0;
    let height = window.heightMap[y][x];
    let expected = window.expectedHeightMap[y][x];
    if(height < WATER_HEIGHT){
        function sigma(n){
            return n * n;
        }
        // From [0,0,63,255] to [128,128,255,255]
        const rg = sigma(height / WATER_HEIGHT) * 128
        const b = sigma(height / WATER_HEIGHT) * 192 + 63;
        put(x,y,rg,rg,b,255)
    }else if(expected < SAND_HEIGHT){
        let r = 200;
        let g = 200;
        let b = 127;
        const change = heightLighting(x,y);
        r *= change;
        g *= change;
        b *= change;
        put(x,y,r,g,b,255);
    }else if(height < expected){
        if(expected - height < DIRT_HEIGHT){
            let r = 89;
            let g = 72;
            let b = 64;
            const change = heightLighting(x,y);
            r *= change;
            g *= change;
            b *= change;
            put(x,y,r,g,b,255);
        }else{
            // STONE
            let r = 100;
            let g = 100;
            let b = 127;
            const change = heightLighting(x,y);
            r *= change;
            g *= change;
            b *= change;
            put(x,y,r,g,b,255);
        }
    }else{
        // From [0,63,0,255] to [63,255,63,255]
        let rb = ((height - SAND_HEIGHT) / (1-SAND_HEIGHT)) * 63;
        let g = ((height - SAND_HEIGHT) / (1-SAND_HEIGHT)) * 192 + 63;

        const change = heightLighting(x,y);
        rb *= change;
        g *= change;

        put(x,y,rb,g,rb,255)
    }
}

function explode(x, y, BOOM_POWER){
    explosions.push(new Explosion(x,y,BOOM_POWER))
    const BOOM_VERTICAL_POWER = BOOM_POWER * (0.1/24);
    const targetZ = tryget(x,y);
    // BOOM
    dudes.forEach(c=>{
        if((c.x - x) ** 2 + (c.y - y) ** 2 < BOOM_POWER ** 2){
            c.alive = false;
        }
    })
    for(let t in HQs){
        if((HQs[t].x - x) ** 2 + (HQs[t].y - y) ** 2 < BOOM_POWER ** 2){
            HQs[t] = false;
        }
    }
    for(let dx = BOOM_POWER; dx >= -BOOM_POWER; dx--){
        const dx2 = dx * dx;
        for (let dy = -BOOM_POWER; dy <= BOOM_POWER; dy++){
            const dy2 = dy * dy;
            if (dx2 + dy2 <= BOOM_POWER ** 2){
                let dist = (dx2 + dy2);
                const dz = (Math.sqrt((BOOM_POWER*BOOM_POWER) - dist) / BOOM_POWER) * BOOM_VERTICAL_POWER;
                const f = tryget(x+dx,y+dy);
                if(targetZ - dz >= f) continue;
                tryset(x+dx,y+dy,Math.max(0.0, targetZ-dz + (cyrb64(`${x},${y},${dx},${dy},${+new Date()}`)[0]/2**32) * 0.01));
                updatePixel(x+dx,y+dy);
            }
        }
    }
}

function makesandy(x,y){
    while(x < 0) x += WIDTH;
    while(y < 0) y += HEIGHT;
    while(x >= WIDTH) x -= WIDTH;
    while(y >= HEIGHT) y -= HEIGHT;
    expectedHeightMap[y>>>0][x>>>0] = 0.0;
}

function fill(x, y, BOOM_POWER){
    const BOOM_VERTICAL_POWER = BOOM_POWER * (0.1/24);
    const targetZ = tryget(x,y);
    for(let dx = BOOM_POWER; dx >= -BOOM_POWER; dx--){
        const dx2 = dx * dx;
        for (let dy = -BOOM_POWER; dy <= BOOM_POWER; dy++){
            const dy2 = dy * dy;
            if (dx2 + dy2 <= BOOM_POWER ** 2){
                let dist = (dx2 + dy2);
                const dz = (Math.sqrt((BOOM_POWER*BOOM_POWER) - dist) / BOOM_POWER) * BOOM_VERTICAL_POWER;
                const f = tryget(x+dx,y+dy);
                let n = Math.min(1.0 - (cyrb64(`${x+dx},${y+dy}`)[0]/2**32) * 0.01, Math.max(f, targetZ+dz + (cyrb64(`${x},${y},${dx},${dy},${+new Date()}`)[0]/2**32) * 0.01));
                if(n > f){
                    makesandy(x+dx,y+dy);
                    tryset(x+dx,y+dy,n);
                    updatePixel(x+dx,y+dy);
                }
            }
        }
    }
}

canvas.addEventListener("contextmenu", (evnt)=>{
    const rect = evnt.target.getBoundingClientRect();
    let x = evnt.clientX - rect.left;
    let y = evnt.clientY - rect.top;
    x *= WIDTH / rect.width;
    y *= HEIGHT / rect.height;
    fill(x, y, 24);
    evnt.preventDefault();
    return false;
})

canvas.addEventListener("mousedown", (evnt) => {
    const rect = evnt.target.getBoundingClientRect();
    let x = evnt.clientX - rect.left;
    let y = evnt.clientY - rect.top;
    x *= WIDTH / rect.width;
    y *= HEIGHT / rect.height;
    if(evnt.button === 0){
        if(!HQs[0]){
            dudes.filter(c=>c.team === 0).forEach(c=>{c.x = x >>> 0; c.y = y >>> 0; c.target = []})
            return;
        }
        if(!HQs[1]){
            dudes.filter(c=>c.team === 1).forEach(c=>{c.x = x >>> 0; c.y = y >>> 0; c.target = []})
            return;
        }
        explode(x, y, 24);
    }
})

function RAIN(){
    let x = Math.random()*WIDTH;
    let y = Math.random()*HEIGHT;
    let xvel = 0;
    let yvel = 0;

    
    let life = 1000; // The amount of ticks to run for
    const EARTH_PER_TICK = (1/(life * 4)) / 128;
    let earth = 0;
    while(life > 0){
        // If we're off map, fail.
        while(x < 0)x+=WIDTH;
        while(y < 0)y+=HEIGHT;
        while(x >= WIDTH)x-=WIDTH;
        while(y >= HEIGHT)y-=HEIGHT;

        const xfloor = x >>> 0;
        const yfloor = y >>> 0;
        const xplus1 = ((xfloor+1) >= WIDTH) ? 0 : xfloor+1;
        const yplus1 = ((yfloor+1) >= HEIGHT) ? 0 : yfloor+1;

        const xfrac = x % 1;
        const yfrac = y % 1;

        const x0y0 = window.heightMap[yfloor][xfloor]
        const x1y0 = window.heightMap[yfloor][xplus1]
        const x0y1 = window.heightMap[yplus1][xfloor]
        const x1y1 = window.heightMap[yplus1][xplus1]
        let maxspeed = 1;
        if(Math.max(x0y0,x1y0,x0y1,x1y1) <= WATER_HEIGHT)maxspeed = 0.1;

        const y0 = window.lerp(x0y0, x1y0, xfrac);
        const y1 = window.lerp(x0y1, x1y1, xfrac);
        const x0 = window.lerp(x0y0, x0y1, yfrac);
        const x1 = window.lerp(x1y0, x1y1, yfrac);

        let deltaX = x0 - x1;
        let deltaY = y0 - y1;

        xvel += deltaX;
        yvel += deltaY;
        let mag = Math.sqrt(xvel, yvel)
        if(mag > maxspeed){
            xvel = xvel / mag * maxspeed;
            yvel = yvel / mag * maxspeed;
        }

        for(_y of [yfloor, yplus1]){
            for (_x of [xfloor,xplus1]){
                // Grab some earth from wherever we are.
                if(window.heightMap[_y][_x] < EARTH_PER_TICK){
                    earth += window.heightMap[_y][_x];
                    window.heightMap[_y][_x] = 0;
                }else{
                    earth += EARTH_PER_TICK;
                    window.heightMap[_y][_x] -= EARTH_PER_TICK;
                }
                updatePixel(_x,_y)
            }
        }
        
        // Move by our vel
        x += xvel / 10;
        y += yvel / 10;
        life--;
    }

    while(x < 0)x+=WIDTH;
    while(y < 0)y+=HEIGHT;
    while(x >= WIDTH)x-=WIDTH;
    while(y >= HEIGHT)y-=HEIGHT;

    // Deposit soil here;
    const xfloor = x>>>0;
    const yfloor = y>>>0;
    const xplus1 = ((xfloor+1) >= WIDTH) ? 0 : xfloor+1;
    const yplus1 = ((yfloor+1) >= HEIGHT) ? 0 : yfloor+1;
    for(_y of [yfloor, yplus1]){
        for (_x of [xfloor,xplus1]){
            // Grab put earth whereever we are.
            window.heightMap[_y][_x] += earth / 4;
            updatePixel(_x,_y)
        }
    }
    return earth;
}

const sundirx = 1;
const sundiry = 0;
const sundirz = 0.01;
function redrawHeightMap(){
    for(let y=0; y < HEIGHT; y++){
        for(let x=0; x < WIDTH; x++){
            updatePixel(x,y);
        }
    }
}
function redrawHeightMapDirty(){
    for(let y=0; y < HEIGHT; y+=2){
        for(let x=0; x < WIDTH; x+=2){
            let px = x + (Math.random() * 2)>>>0;
            let py = y + (Math.random() * 2)>>>0;
            updatePixel(px,py);
        }
    }
}

redrawHeightMap();
function frame(){
    //for(let i=0; i < 1000; i++)RAIN();
    draw();
    requestAnimationFrame(frame);
}
frame();

setInterval(()=>{
    let old = WATER_HEIGHT;
    WATER_HEIGHT = (drainTo - WATER_HEIGHT) * 0.005 + WATER_HEIGHT;
    if(Math.abs(WATER_HEIGHT - drainTo) < 0.001)WATER_HEIGHT = drainTo;
    if(WATER_HEIGHT !== old){
        if(WATER_HEIGHT === drainTo)redrawHeightMap();
        else redrawHeightMapDirty();
    }
}, 1000/100);
