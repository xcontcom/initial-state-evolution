# EvoCA: Co-evolutionary Cellular Automata

**Turing-complete gladiators in the Game of Life.**

This project explores a novel evolutionary system where the **initial states** of Conway’s Game of Life are evolved using **genetic algorithms**. Unlike traditional simulations where behavior is hand-crafted, here we let **evolution do the crafting**, using Conway's Game of Life as the computational medium.

## 🧬 Genetic Search in a Turing-Complete Universe

Conway’s Game of Life is **Turing-complete**. That means it can simulate any computable process — logic gates, circuits, glider guns, even digital computers.

But Turing-completeness doesn’t guarantee meaningful behavior — just that it’s possible.

> So how do we find those rare, meaningful behaviors in an infinite space of chaos?

We evolve them.

The genetic algorithm becomes our **navigator**, a blind but relentless searcher. It doesn’t know what a clock is, or a glider, or a machine — but it rewards **activity, change, and interaction**. Slowly, patterns emerge.

Not because we designed them — but because the **substrate allows them**, and the **fitness pressure pulls them from the void**.

This isn’t just a simulation. It’s an **expedition into possibility**.

## 🧠 How It Works

- The grid (2D bitfield) is the **genome**.
- Conway's Game of Life is the fixed rule (**environment**).
- Each individual is a **field** (not just a cell or a rule).
- Two populations evolve **in parallel**.
- At each epoch, a pair from each population is combined and evolved together on a toroidal grid.
- After 100 steps, fitness is measured by how much the **other field** changes from step 100 to 101.

## ⚔️ Co-evolution, Not Competition

- There are no fixed "predators" or "prey".
- Fields can attack, defend, or stabilize — it’s up to evolution.
- Fitness of A = how alive B remains (change between step 100 and 101).
- And vice versa. This creates **feedback pressure** between populations.

## 📚 Related Project

This project is a **follow-up** to [Evolving Cellular Automata](https://github.com/xcontcom/evolving-cellular-automata), where the focus was on **evolving the rules** of cellular automata. In that earlier project, the 512-bit rule space defined the genotype, and fitness was tied to patterns produced after N iterations.

Here, we **fix the rule** (Conway’s Game of Life) and evolve the **initial field state** instead — flipping the genetic axis from **rule evolution** to **field evolution**.

## 📈 Observations

- Low mutation rates produce slow, stable evolutionary progress.
- Dispersion of fitness is high initially, but may collapse around epoch 500.
- This collapse is often followed by **wild fitness fluctuations**, suggesting complex interdependence or critical transitions.

## 📁 Repo Structure

```
📁 initial-state-evolution/
├── automata.html            # Single Conway's Game of Life automata for example
├── automata.js              # Logic for Conway's Game of Life (used in automata.html)
├── draw_node.js             # Main project file (entry point)
├── repl.js                  # Command-line REPL to launch cell functions
├── style.css                # Styles for testpop_from_file.html
├── testpop_from_file.html   # Client-side visualizer for 5 random automata
├── testpop_from_file.js     # JavaScript logic for client visualizer
├── visualize.html           # Heatmap viewer
├── storage/                 # Directory for saved .json population/fitness data
├── README.md                # Project overview and theory
```

## 🚀 Running the Simulation

```bash
node repl.js
```

Use this functions:

```js
module.exports = { evil, recreate, mutate, printBestGrid, restoreBestPopulations };

cell.recreate(); // New population
cell.evil(1000); // Run 1000 epochs
```

## 📜 License

MIT License. See [LICENSE](LICENSE) for details.

## 📬 Contact

**Serhii Herasymov**  
📧 sergeygerasimofff@gmail.com  
🌐 https://github.com/xcontcom


---

> Built not to model life as it is, but to search for what life *could be* — in Conway’s strange, silent universe.
