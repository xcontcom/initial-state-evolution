# Legacy Code from draw_node.js

This file contains code that was used in `draw_node.js` for experiments. It has been moved here to preserve it for potential future use or reference.

## Unused Functions and Variables

### crossover
This function performs a crossover operation by splitting two parent fields at a random point.

```javascript
function crossover(parent1, parent2) {
	const child = [];
	const cutx = Math.floor(Math.random() * sizex);
	const cuty = Math.floor(Math.random() * sizey);

	for (let x = 0; x < sizex; x++) {
		child[x] = new Int8Array(sizey);
		for (let y = 0; y < sizey; y++) {
			if (x < cutx || (x === cutx && y <= cuty)) {
				child[x][y] = parent1[x][y];
			} else {
				child[x][y] = parent2[x][y];
			}
		}
	}
	return child;
}
```

### dumpGrid
This function was used for debugging to print a grid to the console.

```javascript
function dumpGrid(arr, width = sizex, height = sizey) {
	const gridA = arr;
	for (let y = 0; y < height; y++) {
		let row = '';
		for (let x = 0; x < width; x++) {
			row += gridA[x][y] ? '■ ' : '. ';
		}
		console.log(row);
	}	
}
```

### __countDifference
An experimental fitness function incorporating entropy and glider detection.

```javascript
function __countDifference(fieldA, fieldB, different=true, width = sizex, height = sizey) {
	let changesInB = countDifference2(fieldA, fieldB, true);
	let entropyB = calculateEntropy(fieldA);
	let maxEntropy = Math.log2(Math.pow(2, 9)); // Max for 3x3 patterns
	let entropyScore = (entropyB > 0.2 * maxEntropy && entropyB < 0.8 * maxEntropy) ? 1 : 0;
	
	let gliderCount = countGliders(fieldB);
	
	return (changesInB/10 + 10 * gliderCount) * (1 + entropyScore); // Boost fitness for structured fields
}
```

### __countDifference2
A helper function for counting differences between two fields. Called by `__countDifference`.

```javascript
function __countDifference2(fieldA, fieldB, different=true, width = sizex, height = sizey) {
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
```

### calculateEntropy
This function calculates the entropy of a field based on 3x3 neighborhood patterns. It was used by `__countDifference`.

```javascript
function calculateEntropy(field, width = sizex, height = sizey) {
	let counts = {};
	for (let x = 0; x < width; x++) {
	for (let y = 0; y < height; y++) {
		let pattern = '';
		// Consider a 3x3 neighborhood
		for (let dx = -1; dx <= 1; dx++) {
		for (let dy = -1; dy <= 1; dy++) {
			let nx = (x + dx + width) % width;
			let ny = (y + dy + height) % height;
			pattern += field[nx][ny];
		}
		}
		counts[pattern] = (counts[pattern] || 0) + 1;
	}
	}
	let entropy = 0;
	let total = width * height;
	for (let pattern in counts) {
	let p = counts[pattern] / total;
	entropy -= p * Math.log2(p);
	}
	return entropy;
}
```

### countGliders and Related Variables/Functions
This function counts glider patterns in a field, considering all eight orientations (rotations and reflections). It was used by `__countDifference`.

```javascript
// Define the base glider template
const gliderTemplate = [
	[0, 1, 0],
	[0, 0, 1],
	[1, 1, 1]
];

// Helper function to rotate a 3x3 template by 90° clockwise
function rotate90(template) {
	const size = 3;
	const rotated = Array(size).fill().map(() => Array(size).fill(0));
	for (let i = 0; i < size; i++) {
		for (let j = 0; j < size; j++) {
			rotated[j][size - 1 - i] = template[i][j];
		}
	}
	return rotated;
}

// Helper function to mirror a 3x3 template horizontally (left-right flip)
function mirrorHorizontal(template) {
	const size = 3;
	const mirrored = Array(size).fill().map(() => Array(size).fill(0));
	for (let i = 0; i < size; i++) {
		for (let j = 0; j < size; j++) {
			mirrored[i][size - 1 - j] = template[i][j];
		}
	}
	return mirrored;
}

// Generate all eight glider orientations:
// - Four rotations of the original template
// - Four rotations of the horizontally mirrored template
const gliderTemplates = [
	gliderTemplate, // 0°
	rotate90(gliderTemplate), // 90°
	rotate90(rotate90(gliderTemplate)), // 180°
	rotate90(rotate90(rotate90(gliderTemplate))), // 270°
	mirrorHorizontal(gliderTemplate), // Horizontal mirror, 0°
	rotate90(mirrorHorizontal(gliderTemplate)), // Horizontal mirror, 90°
	rotate90(rotate90(mirrorHorizontal(gliderTemplate))), // Horizontal mirror, 180°
	rotate90(rotate90(rotate90(mirrorHorizontal(gliderTemplate)))) // Horizontal mirror, 270°
];

// Function to count gliders in all eight orientations
function countGliders(field, width = 55, height = 55) {
	let count = 0;
	for (let x = 0; x < width; x++) {
		for (let y = 0; y < height; y++) {
			// Check each of the eight templates
			for (let template of gliderTemplates) {
				let match = true;
				for (let dx = 0; dx < 3; dx++) {
					for (let dy = 0; dy < 3; dy++) {
						let nx = (x + dx) % width; // Periodic boundary
						let ny = (y + dy) % height;
						if (field[nx][ny] !== template[dx][dy]) {
							match = false;
							break;
						}
					}
					if (!match) break;
				}
				if (match) {
					count++;
					break; // Avoid double-counting at this position
				}
			}
		}
	}
	return count;
}
```

### countDifference2
An alternative fitness function incorporating glider detection.

```javascript
function countDifference2(fieldB_100, fieldB_101) {
	let changesInB = countDifference2(fieldB_100, fieldB_101, false);
	let gliderCount = countGliders(fieldB_100);
	return changesInB/1000 + 100 * gliderCount; // Bonus for gliders in any orientation
}
```