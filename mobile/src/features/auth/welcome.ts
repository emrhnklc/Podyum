// Uygulama açılışında karşılama ekranı bir kez gösterilir. Gerçek oturum
// gelene kadar yalnız bellekte tutulur; uygulama yeniden açılınca sıfırlanır.
let welcomed = false;

export function hasWelcomed() {
  return welcomed;
}

export function markWelcomed() {
  welcomed = true;
}

// Çıkış yapınca karşılama ekranı yeniden gösterilir.
export function resetWelcomed() {
  welcomed = false;
}
