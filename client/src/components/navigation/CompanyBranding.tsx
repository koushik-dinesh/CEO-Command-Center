const SYMBOL_SRC = '/branding/biometric-cables-symbol.png';

export default function CompanyBranding() {
  return (
    <div className="exec-header-company" aria-label="Biometric Cables">
      <img
        src={SYMBOL_SRC}
        alt=""
        aria-hidden="true"
        className="exec-company-symbol"
        width={101}
        height={139}
        decoding="async"
      />
      <div className="exec-company-brand">
        <p className="exec-company-primary">Biometric Cables</p>
        <p className="exec-company-tagline">Excellence till Acceptance</p>
      </div>
    </div>
  );
}
