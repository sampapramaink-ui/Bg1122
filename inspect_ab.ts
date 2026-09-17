import { db } from './src/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

async function check() {
  const liveState = await getDoc(doc(db, 'andar_bahar_live_state', 'current_round'));
  console.log('LIVE STATE:', JSON.stringify(liveState.data(), null, 2));
  
  const configDoc = await getDoc(doc(db, 'andar_bahar_config', 'main'));
  console.log('CONFIG MAIN:', JSON.stringify(configDoc.data(), null, 2));

  const gameSettings = await getDoc(doc(db, 'game_settings', 'andar_bahar'));
  console.log('GAME SETTINGS:', JSON.stringify(gameSettings.data(), null, 2));

  const roundsSnap = await getDocs(collection(db, 'andar_bahar_rounds'));
  console.log('SAVED ROUNDS COUNT:', roundsSnap.size);
  const recentRounds: any[] = [];
  roundsSnap.forEach(d => recentRounds.push({ id: d.id, ...d.data() }));
  recentRounds.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  console.log('LAST 5 ROUNDS IN FIRESTORE:', JSON.stringify(recentRounds.slice(0, 5), null, 2));

  const betsSnap = await getDocs(collection(db, 'andar_bahar_live_bets'));
  console.log('LIVE BETS IN FIRESTORE:', betsSnap.size);
  betsSnap.forEach(d => console.log('BET:', d.id, d.data()));

  process.exit(0);
}
check().catch(console.error);
