import { createSignal } from 'solid-js';
import styles from './TopPanel.module.css'

export default function TopPanel () {
    const[level, setLevel] = createSignal(1);

    return (
        <div class={styles.panel}>
            <span>Level: {level()}</span>
        </div>
    );
}
