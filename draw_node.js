const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const PopulationSize = 200;
let fitnessA = [];
let fitnessB = [];
let populationA = [];
let populationB = [];
const sizex = 233;
const sizey = 233;
let mutationRate = 1; // 1% mutations
let mutationGenes = 1; // 1 gen mutate
const stepsNumber=500;
const newPopulationRate=0.1;

/// File Storage Functions ///
const storagePath = path.join(__dirname, 'storage');

function ensureStorageDir() {
	if (!fs.existsSync(storagePath)) {
		fs.mkdirSync(storagePath);
	}
}

function savePopulation() {
	ensureStorageDir();
	fs.writeFileSync(path.join(storagePath, 'populationA.json'), JSON.stringify(populationA));
	fs.writeFileSync(path.join(storagePath, 'populationB.json'), JSON.stringify(populationB));
	fs.writeFileSync(path.join(storagePath, 'fitnessA.json'), JSON.stringify(fitnessA));
	fs.writeFileSync(path.join(storagePath, 'fitnessB.json'), JSON.stringify(fitnessB));
}

function resumePopulation() {
	ensureStorageDir();
	const files = [
		'populationA.json',
		'populationB.json',
		'fitnessA.json',
		'fitnessB.json'
	];
	for (let file of files) {
		if (!fs.existsSync(path.join(storagePath, file))) {
			return false;
		}
	}
	populationA = JSON.parse(fs.readFileSync(path.join(storagePath, 'populationA.json'), 'utf8'));
	populationB = JSON.parse(fs.readFileSync(path.join(storagePath, 'populationB.json'), 'utf8'));
	fitnessA = JSON.parse(fs.readFileSync(path.join(storagePath, 'fitnessA.json'), 'utf8'));
	fitnessB = JSON.parse(fs.readFileSync(path.join(storagePath, 'fitnessB.json'), 'utf8'));
	return true;
}
/// File Storage Functions ///

function convayRulle() {
	const r = [
		0,0,0,1,0,0,0,0,0,
		0,0,1,1,0,0,0,0,0
	];
	//010001011100011111
	//111110101100010111
	//000010111111110111

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

function newPopulation() {
	populationA = [];
	populationB = [];
	fitnessA = [];
	fitnessB = [];
	ensureStorageDir();
	fs.readdirSync(storagePath).forEach(file => fs.unlinkSync(path.join(storagePath, file)));

	for (let n = 0; n < PopulationSize; n++) {
		populationA[n] = [];
		populationB[n] = [];
		for (let x = 0; x < sizex; x++) {
			populationA[n][x] = new Int8Array(sizey);
			populationB[n][x] = new Int8Array(sizey);
			for (let y = 0; y < sizey; y++) {
				populationA[n][x][y] = Math.random() < newPopulationRate ? 1 : 0; // % live cells for sparsity
				populationB[n][x][y] = Math.random() < newPopulationRate ? 1 : 0;
			}
		}
		fitnessA[n] = 0;
		fitnessB[n] = 0;
	}
	savePopulation();
}

function init() {
	if (!resumePopulation()) {
		newPopulation();
	}
	loadBestCombinedAverageFitness();
}

function clearFitness() {
	for (let n = 0; n < PopulationSize; n++) {
		fitnessA[n] = 0;
		fitnessB[n] = 0;
	}
	savePopulation();
}

function sortf(a, b) {
	if (a[1] < b[1]) return 1;
	else if (a[1] > b[1]) return -1;
	else return 0;
}

function evolute() {
	const halfSize = PopulationSize / 2;
	const quarterSize = halfSize / 2;

	// Evolve Population A
	let arraytA = [];
	for (let n = 0; n < PopulationSize; n++) {
		arraytA[n] = [populationA[n], fitnessA[n], n];
	}
	arraytA.sort(sortf);
	arraytA.length = halfSize;

	let newPopulationA = [];
	for (let i = 0; i < quarterSize; i++) {
		const i0 = i * 4;
		const i1 = i * 4 + 1;
		const i2 = i * 4 + 2;
		const i3 = i * 4 + 3;

		const removed1 = Math.floor(Math.random() * arraytA.length);
		const parent1 = arraytA.splice(removed1, 1)[0][0];
		const removed2 = Math.floor(Math.random() * arraytA.length);
		const parent2 = arraytA.splice(removed2, 1)[0][0];

		const child1 = crossoverNoiseBased(parent1, parent2);
		const child2 = crossoverNoiseBased(parent2, parent1);

		newPopulationA[i0] = cloneField(parent1);
		newPopulationA[i1] = cloneField(parent2);
		newPopulationA[i2] = child1;
		newPopulationA[i3] = child2;

		fitnessA[i0] = 0;
		fitnessA[i1] = 0;
		fitnessA[i2] = 0;
		fitnessA[i3] = 0;
	}

	// Evolve Population B
	let arraytB = [];
	for (let n = 0; n < PopulationSize; n++) {
		arraytB[n] = [populationB[n], fitnessB[n], n];
	}
	arraytB.sort(sortf);
	arraytB.length = halfSize;

	let newPopulationB = [];
	for (let i = 0; i < quarterSize; i++) {
		const i0 = i * 4;
		const i1 = i * 4 + 1;
		const i2 = i * 4 + 2;
		const i3 = i * 4 + 3;

		const removed1 = Math.floor(Math.random() * arraytB.length);
		const parent1 = arraytB.splice(removed1, 1)[0][0];
		const removed2 = Math.floor(Math.random() * arraytB.length);
		const parent2 = arraytB.splice(removed2, 1)[0][0];

		const child1 = crossoverNoiseBased(parent1, parent2);
		const child2 = crossoverNoiseBased(parent2, parent1);

		newPopulationB[i0] = cloneField(parent1);
		newPopulationB[i1] = cloneField(parent2);
		newPopulationB[i2] = child1;
		newPopulationB[i3] = child2;

		fitnessB[i0] = 0;
		fitnessB[i1] = 0;
		fitnessB[i2] = 0;
		fitnessB[i3] = 0;
	}

	// Mutation for Population A
	const m = 100 / mutationRate;
	const m2 = mutationGenes;
	for (let i = 0; i < PopulationSize; i++) {
		if (Math.floor(Math.random() * m) === 0) {
			const flips = Math.floor(Math.random() * m2) + 1;
			for (let j = 0; j < flips; j++) {
				const x = Math.floor(Math.random() * sizex);
				const y = Math.floor(Math.random() * sizey);
				newPopulationA[i][x][y] = 1 - newPopulationA[i][x][y];
			}
		}
	}

	// Mutation for Population B
	for (let i = 0; i < PopulationSize; i++) {
		if (Math.floor(Math.random() * m) === 0) {
			const flips = Math.floor(Math.random() * m2) + 1;
			for (let j = 0; j < flips; j++) {
				const x = Math.floor(Math.random() * sizex);
				const y = Math.floor(Math.random() * sizey);
				newPopulationB[i][x][y] = 1 - newPopulationB[i][x][y];
			}
		}
	}
	
	shuffleArray(newPopulationA);
	populationA = newPopulationA;
	populationB = newPopulationB;
	savePopulation();
}

function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]]; // Swap elements
	}
}

function crossoverNoiseBased(parent1, parent2) {
	const child = [];
	for (let x = 0; x < sizex; x++) {
		child[x] = new Int8Array(sizey);
		for (let y = 0; y < sizey; y++) {
			if (Math.random() < 0.5) {
				child[x][y] = parent1[x][y];
			} else {
				child[x][y] = parent2[x][y];
			}
		}
	}
	return child;
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

function test(epoch) {
	if (!populationA || populationA.length === 0 || !populationB || populationB.length === 0) {
		init();
	}
	const rule = convayRulle();
	

	for (let n = 0; n < PopulationSize; n++) {
		
		// Create a combined grid (55x110) for Field A and Field B
		const combinedWidth = sizex; // Rows
		const combinedHeight = sizey * 2; // Columns (55x110)
		const combinedGrid = new Array(combinedWidth);
		for (let x = 0; x < combinedWidth; x++) {
			combinedGrid[x] = new Int8Array(combinedHeight);
			// Copy Field A (columns 0-54)
			for (let y = 0; y < sizey; y++) {
				combinedGrid[x][y] = populationA[n][x][y];
			}
			// Copy Field B (columns 55-109)
			for (let y = 0; y < sizey; y++) {
				combinedGrid[x][y + sizey] = populationB[n][x][y];
			}
		}
		
		// Run Conway's Game of Life on the combined grid for 100 steps
		let array = combinedGrid;
		for (let step = 0; step < stepsNumber; step++) {
			array = stepFieldCombined(array, rule, combinedWidth, combinedHeight);
		}

		// Save the state at step 100
		const after100 = cloneField(array, combinedWidth, combinedHeight);

		// Run one more step to step 101
		array = stepFieldCombined(array, rule, combinedWidth, combinedHeight);

		// Extract Field A and Field B at steps 100 and 101
		const fieldA_100 = new Array(sizex);
		const fieldB_100 = new Array(sizex);
		const fieldA_101 = new Array(sizex);
		const fieldB_101 = new Array(sizex);
		for (let x = 0; x < sizex; x++) {
			fieldA_100[x] = new Int8Array(sizey);
			fieldB_100[x] = new Int8Array(sizey);
			fieldA_101[x] = new Int8Array(sizey);
			fieldB_101[x] = new Int8Array(sizey);
			for (let y = 0; y < sizey; y++) {
				fieldA_100[x][y] = after100[x][y]; // Field A (columns 0-54)
				fieldB_100[x][y] = after100[x][y + sizey]; // Field B (columns 55-109)
				fieldA_101[x][y] = array[x][y];
				fieldB_101[x][y] = array[x][y + sizey];
			}
		}

		// Calculate fitness: Fitness of A is the number of cells in B that changed, and vice versa
		const changesInA = countDifference(fieldA_100, fieldA_101, true);
		const changesInB = countDifference(fieldB_100, fieldB_101, true);
		fitnessA[n] = changesInB; // Fitness of A is changes in B
		fitnessB[n] = changesInA; // Fitness of B is changes in A
		//if (n === 0) console.log(`Pair ${n}: A fitness = ${fitnessA[n]} (changes in B), B fitness = ${fitnessB[n]} (changes in A)`);
	}
	testevolute(epoch);
	evolute();
}

function test100and101steps() {
    // Ensure populations are initialized
    if (!populationA || populationA.length < 2 || !populationB || populationB.length < 2) {
        console.error("Populations not initialized or too small. Run init() first.");
        return;
    }

    const rule = convayRulle();

    // Create a combined grid for Field A[1] and Field B[1]
    const combinedWidth = sizex; // 233
    const combinedHeight = sizey * 2; // 466
    const combinedGrid = new Array(combinedWidth);
    for (let x = 0; x < combinedWidth; x++) {
        combinedGrid[x] = new Int8Array(combinedHeight);
        // Copy Field A[1]
        for (let y = 0; y < sizey; y++) {
            combinedGrid[x][y] = populationA[1][x][y]; // First dude from population A
        }
        // Copy Field B[1]
        for (let y = 0; y < sizey; y++) {
            combinedGrid[x][y + sizey] = populationB[1][x][y]; // First dude from population B
        }
    }

    // Run Conway's Game of Life for 100 steps
    let array = combinedGrid;
    for (let step = 0; step < stepsNumber; step++) {
        array = stepFieldCombined(array, rule, combinedWidth, combinedHeight);
    }

    // Save state at step 100
    const after100 = cloneField(array, combinedWidth, combinedHeight);

    // Run one more step to 101
    array = stepFieldCombined(array, rule, combinedWidth, combinedHeight);

    // Create canvas (233x466 pixels, 1 pixel per cell)
    const canvas = createCanvas(combinedWidth, combinedHeight);
    const ctx = canvas.getContext('2d');

    // Compare steps 100 and 101, draw white for changes, black for no changes
    for (let x = 0; x < combinedWidth; x++) {
        for (let y = 0; y < combinedHeight; y++) {
            const changed = after100[x][y] !== array[x][y];
            ctx.fillStyle = changed ? 'white' : 'black';
            ctx.fillRect(x, y, 1, 1); // 1x1 pixel per cell
        }
    }

    // Save canvas as PNG
    ensureStorageDir();
    const outputPath = path.join(storagePath, 'changes_100_101.png');
    const out = fs.createWriteStream(outputPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => {
        console.log(`Saved changes visualization to ${outputPath}`);
    });

    // Optional: Log boundary changes for insight
    let boundaryChanges = 0;
    let totalChanges = 0;
    for (let x = 0; x < combinedWidth; x++) {
        for (let y = 0; y < combinedHeight; y++) {
            if (after100[x][y] !== array[x][y]) {
                totalChanges++;
                if (y >= sizey - 10 && y < sizey + 10) { // Near y=232/233 boundary
                    boundaryChanges++;
                }
            }
        }
    }
    console.log(`Boundary changes (y=${sizey-10}-${sizey+10}): ${boundaryChanges}/${totalChanges}`);
}

function test100and101steps2(numStatesToTrack = 10, stepsNumberForTest = stepsNumber) {
    // Ensure populations are initialized
    if (!populationA || populationA.length < 2 || !populationB || populationB.length < 2) {
        console.error("Populations not initialized or too small. Run init() first.");
        return;
    }

    const rule = convayRulle();

    // Create combined grid for Field A[1] and Field B[1]
    const combinedWidth = sizex;
    const combinedHeight = sizey * 2;
    const combinedGrid = new Array(combinedWidth);
    for (let x = 0; x < combinedWidth; x++) {
        combinedGrid[x] = new Int8Array(combinedHeight);
        for (let y = 0; y < sizey; y++) {
            combinedGrid[x][y] = populationA[1][x][y]; // Field A[1]
        }
        for (let y = 0; y < sizey; y++) {
            combinedGrid[x][y + sizey] = populationB[1][x][y]; // Field B[1]
        }
    }

    // Run cellular automaton for stepsNumberForTest steps
    let array = combinedGrid;
    for (let step = 0; step < stepsNumberForTest; step++) {
        array = stepFieldCombined(array, rule, combinedWidth, combinedHeight);
    }

    // Store states from stepsNumberForTest to stepsNumberForTest + numStatesToTrack
    const states = [cloneField(array, combinedWidth, combinedHeight)]; // Start at stepsNumberForTest
    for (let step = 0; step < numStatesToTrack; step++) {
        array = stepFieldCombined(array, rule, combinedWidth, combinedHeight);
        states.push(cloneField(array, combinedWidth, combinedHeight));
    }

    // Create change map with grayscale values based on recency
    const changeMap = new Array(combinedWidth);
    for (let x = 0; x < combinedWidth; x++) {
        changeMap[x] = new Float32Array(combinedHeight).fill(0);
    }

    // Compute changes between consecutive states
    for (let s = 0; s < numStatesToTrack; s++) {
        const grayValue = 50 + (205 * s) / (numStatesToTrack - 1); // 50 (oldest) to 255 (newest)
        for (let x = 0; x < combinedWidth; x++) {
            for (let y = 0; y < combinedHeight; y++) {
                if (states[s][x][y] !== states[s + 1][x][y]) {
                    changeMap[x][y] = Math.max(changeMap[x][y], grayValue);
                }
            }
        }
    }

    // Create canvas
    const canvas = createCanvas(combinedWidth, combinedHeight);
    const ctx = canvas.getContext('2d');

    // Draw changes with grayscale gradient
    for (let x = 0; x < combinedWidth; x++) {
        for (let y = 0; y < combinedHeight; y++) {
            const value = Math.round(changeMap[x][y]);
            ctx.fillStyle = value > 0 ? `rgb(${value},${value},${value})` : 'black';
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Save as PNG
    ensureStorageDir();
    const outputPath = path.join(storagePath, 'changes_flickering.png');
    const out = fs.createWriteStream(outputPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => {
        console.log(`Saved flickering visualization (states ${stepsNumberForTest} to ${stepsNumberForTest + numStatesToTrack}) to ${outputPath}`);
    });

    // Log boundary changes for the last transition
    let boundaryChanges = 0;
    let totalChanges = 0;
    for (let x = 0; x < combinedWidth; x++) {
        for (let y = 0; y < combinedHeight; y++) {
            if (states[numStatesToTrack - 1][x][y] !== states[numStatesToTrack][x][y]) {
                totalChanges++;
                if (y >= sizey - 10 && y < sizey + 10) {
                    boundaryChanges++;
                }
            }
        }
    }
    console.log(`Boundary changes (y=${sizey-10}-${sizey+10}, last step): ${boundaryChanges}/${totalChanges}`);
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

function countDifference(fieldA, fieldB, different = true, width = sizex, height = sizey) {
	let diff = 0;
	for (let x = 0; x < width; x++) {
		for (let y = 0; y < height; y++) {
			if ((fieldA[x][y] !== fieldB[x][y]) === different) {
				diff++;
			}
		}
	}
	return diff;
}

// File paths for best populations and average fitness
const bestPopulationAPath = path.join(storagePath, 'bestPopulationA.json');
const bestPopulationBPath = path.join(storagePath, 'bestPopulationB.json');
const bestAverageFitnessPath = path.join(storagePath, 'bestAverageFitness.json');

// Global variable to track the best combined average fitness
let bestCombinedAverageFitness = -Infinity;

// Function to calculate combined average fitness
function calculateCombinedAverageFitness() {
	let sumFitnessA = 0;
	let sumFitnessB = 0;
	for (let i = 0; i < PopulationSize; i++) {
		sumFitnessA += fitnessA[i];
		sumFitnessB += fitnessB[i];
	}
	const averageFitnessA = sumFitnessA / PopulationSize;
	const averageFitnessB = sumFitnessB / PopulationSize;
	return (averageFitnessA + averageFitnessB) / 2;
}

// Function to save the best populations
function saveBestPopulations(combinedAverageFitness) {
	ensureStorageDir();
	fs.writeFileSync(bestPopulationAPath, JSON.stringify(populationA));
	fs.writeFileSync(bestPopulationBPath, JSON.stringify(populationB));
	fs.writeFileSync(bestAverageFitnessPath, JSON.stringify(combinedAverageFitness));
	console.log(`Saved best populations with combined average fitness: ${combinedAverageFitness}`);
}

// Function to load the best populations (optional, for resuming)
function loadBestPopulations() {
	if (fs.existsSync(bestPopulationAPath) && fs.existsSync(bestPopulationBPath) && fs.existsSync(bestAverageFitnessPath)) {
		populationA = JSON.parse(fs.readFileSync(bestPopulationAPath, 'utf8'));
		populationB = JSON.parse(fs.readFileSync(bestPopulationBPath, 'utf8'));
		bestCombinedAverageFitness = JSON.parse(fs.readFileSync(bestAverageFitnessPath, 'utf8'));
		console.log(`Loaded best populations with combined average fitness: ${bestCombinedAverageFitness}`);
		return true;
	}
	return false;
}
// Function to load only the best combined average fitness
function loadBestCombinedAverageFitness() {
	if (fs.existsSync(bestAverageFitnessPath)) {
		bestCombinedAverageFitness = JSON.parse(fs.readFileSync(bestAverageFitnessPath, 'utf8'));
		console.log(`Loaded bestCombinedAverageFitness: ${bestCombinedAverageFitness}`);
		return true;
	}
	console.log("No bestCombinedAverageFitness found. Keeping default value: -Infinity.");
	return false;
}

function testevolute(epoch) {
    let maxfitA = 0;
    let maxfitB = 0;
    let bestIndexA = 0;
    let bestIndexB = 0;

    // Find best fitness and indices for A and B
    for (let i = 0; i < PopulationSize; i++) {
        if (fitnessA[i] > maxfitA) {
            maxfitA = fitnessA[i];
            bestIndexA = i;
        }
        if (fitnessB[i] > maxfitB) {
            maxfitB = fitnessB[i];
            bestIndexB = i;
        }
    }

    // Load existing fitness data
    ensureStorageDir();
    const heatmapFileA = path.join(storagePath, 'heatmapA.json');
    const heatmapFileB = path.join(storagePath, 'heatmapB.json');
    const heatmapAverageFile = path.join(storagePath, 'heatmapAverage.json');
    let heatmapsA = [];
    let heatmapsB = [];
    let heatmapsAverage = [];
    if (fs.existsSync(heatmapFileA)) {
        heatmapsA = JSON.parse(fs.readFileSync(heatmapFileA, 'utf8'));
    }
    if (fs.existsSync(heatmapFileB)) {
        heatmapsB = JSON.parse(fs.readFileSync(heatmapFileB, 'utf8'));
    }
    if (fs.existsSync(heatmapAverageFile)) {
        heatmapsAverage = JSON.parse(fs.readFileSync(heatmapAverageFile, 'utf8'));
    }

    // Store raw fitness arrays
    heatmapsA.push([...fitnessA]);
    heatmapsB.push([...fitnessB]);
    const combinedAverageFitness = calculateCombinedAverageFitness();
    heatmapsAverage.push(combinedAverageFitness);

    // Write updated data to files
    fs.writeFileSync(heatmapFileA, JSON.stringify(heatmapsA));
    fs.writeFileSync(heatmapFileB, JSON.stringify(heatmapsB));
    fs.writeFileSync(heatmapAverageFile, JSON.stringify(heatmapsAverage));

    // Calculate combined average fitness and save if better
    if (combinedAverageFitness > bestCombinedAverageFitness) {
        bestCombinedAverageFitness = combinedAverageFitness;
        saveBestPopulations(combinedAverageFitness);
    }

    console.log(`(total epochs: ${heatmapsA.length}), A=${maxfitA}, B=${maxfitB}, Combined Avg Fitness=${combinedAverageFitness.toFixed(2)}`);
}

function evil(generations) {
	clearFitness();
	for (let i = 0; i < generations; i++) {
		console.log(`Epoch ${i} of ${generations}`);
		test(i);
	}
	savePopulation();
}

function recreate() {
	newPopulation();
	// Reset bestCombinedAverageFitness to -Infinity
	bestCombinedAverageFitness = -Infinity;
	console.log("Reset bestCombinedAverageFitness to -Infinity");	
}

function mutate(percent, genes) {
	if (!percent || !genes) {
		console.log("mutationRate=" + mutationRate + ", mutationGenes=" + mutationGenes);
	} else {
		mutationRate = percent;
		mutationGenes = genes;
	}
}

function printBestGrid() {
	let maxfitA = 0;
	let bestIndexA = 0;
	let maxfitB = 0;
	let bestIndexB = 0;

	for (let i = 0; i < PopulationSize; i++) {
		if (fitnessA[i] > maxfitA) {
			maxfitA = fitnessA[i];
			bestIndexA = i;
		}
		if (fitnessB[i] > maxfitB) {
			maxfitB = fitnessB[i];
			bestIndexB = i;
		}
	}

	console.log(`Best from Population A (individual ${bestIndexA}, fitness=${maxfitA}):`);
	const gridA = populationA[bestIndexA];
	for (let y = 0; y < sizey; y++) {
		let row = '';
		for (let x = 0; x < sizex; x++) {
			row += gridA[x][y] ? '■ ' : '. ';
		}
		console.log(row);
	}

	console.log(`Best from Population B (individual ${bestIndexB}, fitness=${maxfitB}):`);
	const gridB = populationB[bestIndexB];
	for (let y = 0; y < sizey; y++) {
		let row = '';
		for (let x = 0; x < sizex; x++) {
			row += gridB[x][y] ? '■ ' : '. ';
		}
		console.log(row);
	}
}

function restoreBestPopulations() {
	if (loadBestPopulations()) {
		savePopulation(); // Update populationA.json and populationB.json
		clearFitness();	 // Reset fitness for the restored populations
		console.log("Restored best populations. Ready for further evolution.");
	} else {
		console.log("No best populations found to restore.");
	}
}


init();

module.exports = { evil, recreate, mutate, printBestGrid, restoreBestPopulations, test100and101steps, test100and101steps2 };