// src/components/Layout/Layout.jsx
import { Outlet } from 'react-router-dom';
import Header from '../Header/Header';
import styles from './Layout.module.css';

function Layout() {
  return (
    <div className={styles.wrapper}>
      <Header />
      <main className={styles.mainContainer}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;