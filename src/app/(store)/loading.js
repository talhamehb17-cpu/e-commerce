export default function StoreLoading() {
  return (
    <div className="wrap" style={{ padding: '80px 0', minHeight: '60vh' }} aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ width: 120, height: 10, marginBottom: 18 }} />
      <div className="skeleton" style={{ width: 'min(520px,80%)', height: 42, marginBottom: 14 }} />
      <div className="skeleton" style={{ width: 'min(360px,60%)', height: 12, marginBottom: 44 }} />
      <div className="product-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton" style={{ aspectRatio: '4/5', borderRadius: 10 }} />
            <div className="skeleton" style={{ height: 11, width: '70%', marginTop: 12 }} />
            <div className="skeleton" style={{ height: 9, width: '40%', marginTop: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
