import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Admin.module.css';

function Admin() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [results, setResults] = useState([]);
  const [playersCount, setPlayersCount] = useState(0);
  const [testStatus, setTestStatus] = useState(true);
  const [revealStep, setRevealStep] = useState(0);
  
  // POPRAWKA: Prawidłowa definicja stanu ładowania
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const resultsRef = useRef(null);


  // DODAJ TO: Ticker odświeżający czas co sekundę
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Logowanie
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.authenticated) {
        setIsAuthenticated(true);
        fetchInitialData();
      } else {
        setError(data.message || 'Błędne hasło.');
      }
    } catch {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setLoading(false);
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
  const startReveal = async () => {
    if (!window.confirm("Zakończyć test i rozpocząć ceremonię podium?")) return;
    
    // 1. Zablokuj test w bazie
    await supabase.from('settings').update({ is_test_active: false }).eq('id', 1);
    setTestStatus(false);

    // 2. Automatyczne przewinięcie ekranu do sekcji wyników
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // 3. Sekwencja animacji (ZATRZYMUJE SIĘ NA KROKU 3)
    setRevealStep(1);
    setTimeout(() => setRevealStep(2), 3000);
    setTimeout(() => setRevealStep(3), 6000);
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

  // --- KLUCZOWA POPRAWKA LOGIKI LICZNIKÓW ---
  // Skończyło: Osoby, które mają już zapisany czas w bazie (time_seconds > 0)
  const finishedCount = results.filter(r => r.time_seconds && r.time_seconds > 0).length;
  // Pisze teraz: Wszyscy w tabeli results, którzy NIE mają jeszcze zapisanego czasu
  const writingCount = results.filter(r => !r.time_seconds || r.time_seconds === 0).length;

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
            <button onClick={startReveal} className={styles.btnEnd}>
              ⏹ Odsłoń wyniki (Koniec)
            </button>
          ) : (
            <button onClick={resetGroup} className={styles.btnReset} disabled={loading}>
              {loading ? 'Czyszczenie...' : '♻️ Nowa grupa'}
            </button>
          )}
        </div>
      </div>

      {/* --- SEKCJA PODIUM (POJAWIA SIĘ PO KLIKNIĘCIU KONIEC) --- */}
      {!testStatus && revealStep > 0 && revealStep < 4 && (
        <div className={styles.podiumOverlay} ref={resultsRef}>
          <div className={styles.podiumHeader}>
            <h2 className={styles.podiumTitle}>
              {revealStep === 1 && "III Miejsce"}
              {revealStep === 2 && "II Miejsce"}
              {revealStep === 3 && "Zwycięzca! 🏆"}
            </h2>
            <p className={styles.podiumSubtitle}>Oficjalne wyniki rywalizacji</p>
          </div>

          <div className={styles.podiumContainer}>
            {/* Miejsce 2 */}
            <div className={`${styles.podiumBar} ${styles.silver} ${revealStep >= 2 ? styles.showBar : ''}`}>
              <div className={styles.podiumAvatar}>{results[1]?.nickname?.charAt(0) || '?'}</div>
              <div className={styles.podiumInfo}>
                <span className={styles.pNick}>{results[1]?.nickname}</span>
                <span className={styles.pScore}>{results[1]?.score} pkt</span>
              </div>
              <div className={styles.bar}>2</div>
            </div>

            {/* Miejsce 1 */}
            <div className={`${styles.podiumBar} ${styles.gold} ${revealStep >= 3 ? styles.showBar : ''}`}>
              <div className={styles.podiumAvatar}>👑</div>
              <div className={styles.podiumInfo}>
                <span className={styles.pNick}>{results[0]?.nickname}</span>
                <span className={styles.pScore}>{results[0]?.score} pkt</span>
              </div>
              <div className={styles.bar}>1</div>
            </div>

            {/* Miejsce 3 */}
            <div className={`${styles.podiumBar} ${styles.bronze} ${revealStep >= 1 ? styles.showBar : ''}`}>
              <div className={styles.podiumAvatar}>{results[2]?.nickname?.charAt(0) || '?'}</div>
              <div className={styles.podiumInfo}>
                <span className={styles.pNick}>{results[2]?.nickname}</span>
                <span className={styles.pScore}>{results[2]?.score} pkt</span>
              </div>
              <div className={styles.bar}>3</div>
            </div>
          </div>
          {revealStep === 3 && (
            <button 
              onClick={() => setRevealStep(4)} 
              className={styles.btnReset}
              style={{ marginTop: '50px', padding: '1.2rem 2.5rem', fontSize: '1.2rem' }}
            >
              Pokaż pełną listę wyników 📊
            </button>
          )}
        </div>
      )}

      {(testStatus || revealStep === 4) && (
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
      )}
    </div>
  );
}

export default Admin;