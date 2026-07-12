import styles from './styles/TopPanel.module.css'

import { state } from '../store';

export default function TopPanel () {
    return (
        <div class={styles.panel}>
            <span>Level: {state.level}</span>
        </div>
    );
}
