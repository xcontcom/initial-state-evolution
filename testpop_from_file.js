var PopulationSize = 200;
var fitnessA = [];
var fitnessB = [];
var populationA = [];
var populationB = [];
var sizex = 233;
var sizey = 233;
var size = 2; // Pixel size for rendering
var rulesnumbers = []; // Will store indices of pairs to display
var cellscount = 5; // Number of pairs to display
var b = []; // Will store combined grids (55x110) for each pair
var conwayRule = convayRulle(); // Generate Conway rule once
var randa = [];

/// Local Storage Functions ///
async function loadPopulationA() {
    try {
        const response = await fetch('storage/populationA.json');
        if (!response.ok) throw new Error('Failed to load populationA');
        populationA = await response.json();
        return true;
    } catch (error) {
        console.error('Error loading populationA:', error);
        return false;
    }
}

async function loadPopulationB() {
    try {
        const response = await fetch('storage/populationB.json');
        if (!response.ok) throw new Error('Failed to load populationB');
        populationB = await response.json();
        return true;
    } catch (error) {
        console.error('Error loading populationB:', error);
        return false;
    }
}

async function loadFitnessA() {
    try {
        const response = await fetch('storage/fitnessA.json');
        if (!response.ok) throw new Error('Failed to load fitnessA');
        fitnessA = await response.json();
        return true;
    } catch (error) {
        console.error('Error loading fitnessA:', error);
        return false;
    }
}

async function loadFitnessB() {
    try {
        const response = await fetch('storage/fitnessB.json');
        if (!response.ok) throw new Error('Failed to load fitnessB');
        fitnessB = await response.json();
        return true;
    } catch (error) {
        console.error('Error loading fitnessB:', error);
        return false;
    }
}

async function loadBestPopulationA() {
    try {
        const response = await fetch('storage/bestPopulationA.json');
        if (!response.ok) throw new Error('Failed to load bestPopulationA');
        populationA = await response.json();
        return true;
    } catch (error) {
        console.error('Error loading bestPopulationA:', error);
        return false;
    }
}

async function loadBestPopulationB() {
    try {
        const response = await fetch('storage/bestPopulationB.json');
        if (!response.ok) throw new Error('Failed to load bestPopulationB');
        populationB = await response.json();
        return true;
    } catch (error) {
        console.error('Error loading bestPopulationB:', error);
        return false;
    }
}

async function restoreBestPopulations() {
    const bestPopALoaded = await loadBestPopulationA();
    const bestPopBLoaded = await loadBestPopulationB();

    if (!bestPopALoaded || !bestPopBLoaded) {
        console.error('Failed to restore best populations.');
        return false;
    }

    // Reload fitness values
    const fitnessALoaded = await loadFitnessA();
    const fitnessBLoaded = await loadFitnessB();

    if (!fitnessALoaded || !fitnessBLoaded) {
        console.error('Failed to reload fitness values after restoring best populations.');
        return false;
    }

    // Update the visualization
    clearpage();
    console.log('Restored best populations successfully.');
    return true;
}
/// Local Storage Functions ///

function realrand() {
    if (randa.length == 0) {
        for (var i = 0; i < PopulationSize; i++) randa[i] = i;
    }
    var rem = Math.floor(Math.random() * randa.length);
    var sp = randa.splice(rem, 1)[0];
    return sp;
}

function convayRulle() {
    const r = [
        0,0,0,1,0,0,0,0,0,
        0,0,1,1,0,0,0,0,0
    ];
    const rule = [];
    for (let i = 0; i < 512; i++) {
        let q = ((i >> 4) & 1) * 8;
        for (let j = 0; j < 9; j++) {
            q += (i >> j) & 1;
        }
        rule[i] = r[q];
    }
    return rule;
}

function cloneField(field, width = sizex, height = sizey) {
    const newField = [];
    for (let x = 0; x < width; x++) {
        newField[x] = new Int8Array(height);
        for (let y = 0; y < height; y++) {
            newField[x][y] = field[x][y];
        }
    }
    return newField;
}

function stepFieldCombined(array, rule, width = sizex, height = sizey) {
    const temp = new Array(width);
    for (let x = 0; x < width; x++) {
        const xm = (x - 1 + width) % width;
        const xp = (x + 1) % width;
        temp[x] = new Int8Array(height);

        for (let y = 0; y < height; y++) {
            const ym = (y - 1 + height) % height;
            const yp = (y + 1) % height;

            const q = (
                (array[xm][ym] << 8) |
                (array[x][ym] << 7) |
                (array[xp][ym] << 6) |
                (array[xm][y] << 5) |
                (array[x][y] << 4) |
                (array[xp][y] << 3) |
                (array[xm][yp] << 2) |
                (array[x][yp] << 1) |
                array[xp][yp]
            );

            temp[x][y] = rule[q];
        }
    }
    return temp;
}

function clearpage(changenumbers = true) {
    var canvasA, canvasB, canvasCombined, contextA, contextB, contextCombined;
    const combinedWidth = sizex;
    const combinedHeight = sizey * 2;

    for (var n = 0; n < cellscount; n++) {
        b[n] = new Array(combinedWidth);
        for (let x = 0; x < combinedWidth; x++) {
            b[n][x] = new Int8Array(combinedHeight);
        }

        // Canvas for Field A
        canvasA = document.getElementById('c' + n + '_A');
        contextA = canvasA.getContext('2d');
        canvasA.width = sizex * size;
        canvasA.height = sizey * size;
        contextA.fillStyle = 'rgb(0,0,0)';
        contextA.fillRect(0, 0, sizex * size, sizey * size);
        contextA.fillStyle = 'rgb(255,255,255)';

        // Canvas for Field B
        canvasB = document.getElementById('c' + n + '_B');
        contextB = canvasB.getContext('2d');
        canvasB.width = sizex * size;
        canvasB.height = sizey * size;
        contextB.fillStyle = 'rgb(0,0,0)';
        contextB.fillRect(0, 0, sizex * size, sizey * size);
        contextB.fillStyle = 'rgb(255,255,255)';

        // Canvas for Combined Grid
        canvasCombined = document.getElementById('c' + n + '_Combined');
        contextCombined = canvasCombined.getContext('2d');
        canvasCombined.width = sizex * size;
        canvasCombined.height = combinedHeight * size;
        contextCombined.fillStyle = 'rgb(0,0,0)';
        contextCombined.fillRect(0, 0, sizex * size, combinedHeight * size);
        contextCombined.fillStyle = 'rgb(255,255,255)';

        if (changenumbers) {
            rulesnumbers[n] = realrand();
        }

        const index = rulesnumbers[n];
        const fieldA = populationA[index];
        const fieldB = populationB[index];

        for (let x = 0; x < sizex; x++) {
            for (let y = 0; y < sizey; y++) {
                b[n][x][y] = fieldA[x][y];
                if (b[n][x][y]) {
                    contextA.fillRect(x * size, y * size, size, size);
                    contextCombined.fillRect(x * size, y * size, size, size);
                }
                b[n][x][y + sizey] = fieldB[x][y];
                if (b[n][x][y + sizey]) {
                    contextB.fillRect(x * size, y * size, size, size);
                    contextCombined.fillRect(x * size, (y + sizey) * size, size, size);
                }
            }
        }
    }

    document.getElementById('console-log0').innerHTML = "Displayed pairs (indices): " + rulesnumbers.join(', ');
    document.getElementById('console-log1').innerHTML = "Fitness A: " + rulesnumbers.map(n => fitnessA[n]).join(', ') + "<br>Fitness B: " + rulesnumbers.map(n => fitnessB[n]).join(', ');
}

function countpoints() {
    var temp = new Array(cellscount);
    var canvasA, canvasB, canvasCombined, contextA, contextB, contextCombined;
    const combinedWidth = sizex;
    const combinedHeight = sizey * 2;

    for (var n = 0; n < cellscount; n++) {
        canvasA = document.getElementById('c' + n + '_A');
        canvasB = document.getElementById('c' + n + '_B');
        canvasCombined = document.getElementById('c' + n + '_Combined');
        contextA = canvasA.getContext('2d');
        contextB = canvasB.getContext('2d');
        contextCombined = canvasCombined.getContext('2d');
        contextA.fillStyle = 'rgb(0,0,0)';
        contextA.fillRect(0, 0, sizex * size, sizey * size);
        contextB.fillStyle = 'rgb(0,0,0)';
        contextB.fillRect(0, 0, sizex * size, sizey * size);
        contextCombined.fillStyle = 'rgb(0,0,0)';
        contextCombined.fillRect(0, 0, sizex * size, combinedHeight * size);
        contextA.fillStyle = 'rgb(255,255,255)';
        contextB.fillStyle = 'rgb(255,255,255)';
        contextCombined.fillStyle = 'rgb(255,255,255)';

        temp[n] = stepFieldCombined(b[n], conwayRule, combinedWidth, combinedHeight);

        for (var x = 0; x < sizex; x++) {
            for (var y = 0; y < combinedHeight; y++) {
                if (temp[n][x][y]) {
                    if (y < sizey) {
                        contextA.fillRect(x * size, y * size, size, size);
                    } else {
                        contextB.fillRect(x * size, (y - sizey) * size, size, size);
                    }
                    contextCombined.fillRect(x * size, y * size, size, size);
                }
            }
        }
    }
    b = temp;
}

function count100(c) {
    var cm = c - 1;
    var temp;
    const combinedWidth = sizex;
    const combinedHeight = sizey * 2;

    for (var i = 0; i < cm; i++) {
        temp = [];
        for (var n = 0; n < cellscount; n++) {
            temp[n] = stepFieldCombined(b[n], conwayRule, combinedWidth, combinedHeight);
        }
        b = temp;
    }

    var afterPrevStep = new Array(cellscount);
    for (var n = 0; n < cellscount; n++) {
        afterPrevStep[n] = cloneField(b[n], combinedWidth, combinedHeight);
    }
    countpoints();

    for (var n = 0; n < cellscount; n++) {
        var fieldA_prev = new Array(sizex);
        var fieldB_prev = new Array(sizex);
        var fieldA_curr = new Array(sizex);
        var fieldB_curr = new Array(sizex);
        for (var x = 0; x < sizex; x++) {
            fieldA_prev[x] = new Int8Array(sizey);
            fieldB_prev[x] = new Int8Array(sizey);
            fieldA_curr[x] = new Int8Array(sizey);
            fieldB_curr[x] = new Int8Array(sizey);
            for (var y = 0; y < sizey; y++) {
                fieldA_prev[x][y] = afterPrevStep[n][x][y];
                fieldB_prev[x][y] = afterPrevStep[n][x][y + sizey];
                fieldA_curr[x][y] = b[n][x][y];
                fieldB_curr[x][y] = b[n][x][y + sizey];
            }
        }
        countChanges(n, fieldA_prev, fieldA_curr, fieldB_prev, fieldB_curr);
    }
}

function countChanges(pairIndex, fieldA_prev, fieldA_curr, fieldB_prev, fieldB_curr) {
    let changesA = 0;
    let changesB = 0;
    for (var x = 0; x < sizex; x++) {
        for (var y = 0; y < sizey; y++) {
            if (fieldA_prev[x][y] !== fieldA_curr[x][y]) {
                changesA++;
            }
            if (fieldB_prev[x][y] !== fieldB_curr[x][y]) {
                changesB++;
            }
        }
    }
    console.log(`Pair ${pairIndex} after simulation:`);
    console.log(`Field A changes (Fitness B): ${changesA}`);
    console.log(`Field B changes (Fitness A): ${changesB}`);
    return { changesA, changesB };
}

function onestep() {
    countpoints();
}

async function init() {
    var canv = document.getElementById('canv');
    for (var n = 0; n < cellscount; n++) {
        var pairDiv = document.createElement('div');
        pairDiv.setAttribute("class", "pair-container");

        // Field A
        var fieldADiv = document.createElement('div');
        fieldADiv.setAttribute("class", "field-container");
        var labelA = document.createElement('div');
        labelA.setAttribute("class", "field-label");
        labelA.innerHTML = `Pair ${n} - Field A`;
        var canvasA = document.createElement('canvas');
        canvasA.setAttribute("id", "c" + n + "_A");
        var divA = document.createElement('div');
        divA.setAttribute("class", "canv0");
        divA.appendChild(canvasA);
        fieldADiv.appendChild(labelA);
        fieldADiv.appendChild(divA);

        // Field B
        var fieldBDiv = document.createElement('div');
        fieldBDiv.setAttribute("class", "field-container");
        var labelB = document.createElement('div');
        labelB.setAttribute("class", "field-label");
        labelB.innerHTML = `Pair ${n} - Field B`;
        var canvasB = document.createElement('canvas');
        canvasB.setAttribute("id", "c" + n + "_B");
        var divB = document.createElement('div');
        divB.setAttribute("class", "canv0");
        divB.appendChild(canvasB);
        fieldBDiv.appendChild(labelB);
        fieldBDiv.appendChild(divB);

        // Combined Grid
        var combinedDiv = document.createElement('div');
        combinedDiv.setAttribute("class", "field-container");
        var labelCombined = document.createElement('div');
        labelCombined.setAttribute("class", "field-label");
        labelCombined.innerHTML = `Pair ${n} - Combined Grid`;
        var canvasCombined = document.createElement('canvas');
        canvasCombined.setAttribute("id", "c" + n + "_Combined");
        var divCombined = document.createElement('div');
        divCombined.setAttribute("class", "canv0");
        divCombined.appendChild(canvasCombined);
        combinedDiv.appendChild(labelCombined);
        combinedDiv.appendChild(divCombined);

        pairDiv.appendChild(fieldADiv);
        pairDiv.appendChild(fieldBDiv);
        pairDiv.appendChild(combinedDiv);
        canv.appendChild(pairDiv);
    }

    const populationALoaded = await loadPopulationA();
    const populationBLoaded = await loadPopulationB();
    const fitnessALoaded = await loadFitnessA();
    const fitnessBLoaded = await loadFitnessB();

    if (!populationALoaded || !populationBLoaded || !fitnessALoaded || !fitnessBLoaded) {
        console.error('Failed to load data.');
    }

    clearpage();
}

var timerId;
function start() {
    if (!timerId) {
        timerId = setInterval(function() {
            countpoints();
        }, 1);
    }
}

function stop() {
    if (timerId) {
        clearInterval(timerId);
        timerId = false;
    }
}

function clearc() {
    clearpage(false);
}