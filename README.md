# 🎨 ColorFlow

**ColorFlow** is a modern, minimalist, and strategy-based puzzle game built with **React + Tailwind CSS**.  
Your goal: flood the entire board with a single color in as few moves as possible.

---

## 🧠 Game Concept

ColorFlow is a digital interpretation of the classic “Flood It!” puzzle — but rebuilt with smooth transitions, adaptive animations, responsive UI, and state persistence.

- Start from the **top-left corner**.  
- Click on a **color tile** to flood your region with that color.  
- Your area expands to include all connected tiles of the same color.  
- Complete the board in the **least number of moves** to win.

---

## ⚡ Features

✅ **Smooth Flood Animation**  
Sequential cell-fill animation using async batch updates for a natural flowing effect.  

✅ **Responsive UI**  
Adaptive layout that scales perfectly across desktop and mobile screens.  

✅ **Dynamic Color Palettes**  
Supports both **light** and **dark themes** with matching color sets.  

✅ **Game Modes**  
Choose between four modes:  
- 🟢 Easy (8×8, 4 colors)  
- 🟡 Normal (12×12, 6 colors)  
- 🔵 Hard (16×16, 6 colors)  
- 🔴 Expert (20×20, 8 colors)  

✅ **Persistent State & Scores**  
LocalStorage saves your best scores and last game state.  

✅ **Hints & Strategy Mode**  
Optional "Show Strategy" button highlights the most efficient next move.   

---

## 🧩 Tech Stack

- **Frontend:** React 18   
- **Styling:** Tailwind CSS + shadcn/ui  
- **Icons:** Lucide React  
- **State Management:** React Hooks + Local Storage  

---

## 🚀 Installation

```bash
# 1. Clone the repository
git clone https://github.com/Shri-222/Flood-Game.git

# 2. Navigate to the folder
cd Flood-Game

# 3. Install dependencies
npm install

# 4. Run the development server
npm run dev
```

Open the app in your browser at [http://localhost:5173](http://localhost:5173).

---

## 🎮 Controls

| Action | Description |
|--------|--------------|
| Click Color | Floods connected region with selected color |
| Undo | Reverts last move |
| Reset | Generates a new random board |
| Show Strategy | Highlights color with max gain potential |
| New Game | Restarts with same mode or a new mode |

---

## 🧠 Algorithm Notes

ColorFlow uses a **Breadth-First Search (BFS)** flood-fill algorithm combined with a **connected-component boundary analysis** for efficient computation of the best next move.  
Animations are performed asynchronously with adaptive batching to ensure smooth performance even on large grids.

---

## 💡 Future Enhancements

- [ ] Add confetti + animation when game completes  
- [ ] Sound effects on move and completion  
- [ ] Leaderboard integration  
- [ ] Touch / mobile gesture support  
- [ ] Color-blind accessibility palettes  

---

## 👨‍💻 Developer

**Author:** Shri  
**Project:** ColorFlow — Intelligent Flood-It Puzzle  
**Live Demo:** [https://flood-game.netlify.app](https://flood-game.netlify.app)
