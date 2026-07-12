import { createStore } from 'solid-js/store'

export interface GameState {
    level: number;
}

const initialState: GameState = {
    level: 1
}

export const [state, setState] = createStore<GameState>(initialState);
