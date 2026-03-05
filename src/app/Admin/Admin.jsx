import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Admin.module.css';

function Admin() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [results, setResults] = useState([]);
  const [playersCount, setPlayersCount] = useState(0);
  const [testStatus, setTestStatus] = useState(true);
  
  // POPRAWKA: Prawidłowa definicja stanu ładowania
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());


  // DODAJ TO: Ticker odświeżający czas co sekundę
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Logowanie
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === import.meta.env.VITE_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      fetchInitialData();
    } else {
      setError('Błędne hasło.');
    }
  };

  const fetchInitialData = async () => {
    await fetchGlobalSettings();
    await fetchResults();
    await fetchPlayersCount();
  };

  const fetchGlobalSettings = async () => {
    const { data } = await supabase.from('settings').select('is_test_active').eq('id', 1).single();
    if (data) setTestStatus(data.is_test_active);
  };

  const fetchResults = async () => {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .order('score', { ascending: false })
      .order('time_seconds', { ascending: true })
      .order('created_at', { ascending: true });
      
    if (!error) setResults(data);
  };

  const formatTime = (seconds) => {
    if (seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const fetchPlayersCount = async () => {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
      
    if (count !== null) setPlayersCount(count);
  };

  // Realtime
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, () => {
        fetchResults();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayersCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  // Funkcja: Zakończ test
  const endTest = async () => {
    if (window.confirm("ZAKOŃCZYĆ? Wszyscy zobaczą swoje wyniki i odkryjemy nicki!")) {
      await supabase.from('settings').update({ is_test_active: false }).eq('id', 1);
      setTestStatus(false);
      fetchResults();
    }
  };

  // Funkcja: Reset grupy (NAPRAWIONA)
  const resetGroup = async () => {
    if (window.confirm("UWAGA! To usunie WSZYSTKIE wyniki i graczy. Nowa gra?")) {
      // Teraz setLoading jest funkcją, więc zadziała
      setLoading(true);
      
      try {
        // 1. Usuń wyniki
        const { error: err1 } = await supabase
          .from('results')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); 
        if (err1) throw err1;

        // 2. Usuń graczy
        const { error: err2 } = await supabase
          .from('players')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (err2) throw err2;

        // 3. Włącz test ponownie
        const { error: err3 } = await supabase
          .from('settings')
          .update({ is_test_active: true })
          .eq('id', 1);
        if (err3) throw err3;
        
        // Sukces
        setTestStatus(true);
        setResults([]);
        setPlayersCount(0);
        alert("Baza wyczyszczona. Można zaczynać!");

      } catch (err) {
        console.error("Błąd resetowania:", err);
        alert("Wystąpił błąd: " + err.message + "\n(Upewnij się, że wykonałeś kod SQL z uprawnieniami DELETE!)");
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={`animate-fade-in ${styles.loginCard}`}>
        <h2>Panel Nauczyciela 🔒</h2>
        <form onSubmit={handleLogin} className={styles.form}>
          <input 
            type="password" 
            placeholder="Hasło..." 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button}>Zaloguj</button>
        </form>
      </div>
    );
  }

  const finishedCount = results.length;
  const writingCount = Math.max(0, playersCount - finishedCount);

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Panel Sterowania</h2>
          <div className={styles.statsRow}>
            <p className={styles.status}>
              Status: 
              <span className={testStatus ? styles.statusActive : styles.statusEnded}>
                {testStatus ? ' 🟢 TEST TRWA' : ' 🔴 ZAKOŃCZONY'}
              </span>
            </p>
            <div className={styles.liveCounter}>
              <span>Dołączyło: <b>{playersCount}</b></span>
              <span className={styles.divider}>|</span>
              <span>Skończyło: <b>{finishedCount}</b></span>
              <span className={styles.divider}>|</span>
              <span className={styles.pulsing}>Pisze teraz: <b>{writingCount}</b></span>
            </div>
          </div>
          {testStatus && <p className={styles.infoText}>Nicki ukryte do czasu zakończenia.</p>}
        </div>
        
        <div className={styles.actions}>
          {testStatus ? (
            <button onClick={endTest} className={styles.btnEnd}>
              ⏹ Odsłoń wyniki (Koniec)
            </button>
          ) : (
            <button onClick={resetGroup} className={styles.btnReset} disabled={loading}>
              {loading ? 'Czyszczenie...' : '♻️ Nowa grupa'}
            </button>
          )}
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Miejsce</th>
              <th>Uczeń</th>
              <th>Wynik</th>
              <th>Czas</th>
              <th>Godzina</th>
            </tr>
          </thead>
          <tbody>
            {results.map((res, index) => {
              let displayTime = "";
              const isFinished = !!res.time_seconds; // Sprawdzamy czy ma zapisany czas końcowy

              if (isFinished) {
                // Jeśli skończył - pokaż wynik z bazy
                displayTime = formatTime(res.time_seconds);
              } else {
                // Jeśli w trakcie - oblicz: Teraz - CzasStworzeniaRekordu
                const startTime = new Date(res.created_at).getTime();
                const elapsed = Math.floor((now - startTime) / 1000);
                displayTime = formatTime(elapsed);
              }

              let rowClass = styles.rowDefault;
              let medal = '';
              
              if (!testStatus) {
                if (index === 0) { rowClass = styles.gold; medal = '🥇'; }
                else if (index === 1) { rowClass = styles.silver; medal = '🥈'; }
                else if (index === 2) { rowClass = styles.bronze; medal = '🥉'; }
              }

              return (
                <tr key={res.id} className={`${styles.tableRow} ${rowClass}`}>
                  <td className={styles.rankCell}>
                    <span className={styles.rankNum}>#{index + 1}</span> {medal}
                  </td>
                  
                  <td className={styles.nickCell}>
                    {testStatus ? (
                      <span className={styles.hiddenNick}>?????</span> 
                    ) : (
                      <span className={styles.revealedNick}>{res.nickname}</span>
                    )}
                  </td>

                  <td className={styles.scoreCell}>{res.score} / {res.total_questions}</td>
                  <td className={styles.scoreCell}>
                   <span style={{ color: isFinished ? 'inherit' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                      {displayTime}
                      {!isFinished && " ⏱️"}
                    </span>
                  </td>
                  <td className={styles.dateCell}>
                    {new Date(res.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {results.length === 0 && <div className={styles.empty}>Czekam na wyniki...</div>}
      </div>
    </div>
  );
}

export default Admin;