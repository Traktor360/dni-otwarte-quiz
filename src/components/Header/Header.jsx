// src/components/Header/Header.jsx
import styles from './Header.module.css';

function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.logoWrapper}>
          <img src="/logo.png" alt="Logo" className={styles.logo} />
        </div>
        <div className={styles.divider}></div>
        <div className={styles.titleWrapper}>
          <h1 className={styles.title}>DNI OTWARTE ZSTiO</h1>
          <p className={styles.subtitle}>INTERAKTYWNY QUIZ</p>
        </div>
      </div>
    </header>
  );
}

export default Header;