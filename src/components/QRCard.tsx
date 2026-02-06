import { QRCodeCanvas } from 'qrcode.react';

interface QRCardProps {
  title: string;
  subtitle: string;
  nmid: string;
  qrContent: string;
  footerCode: string;
  nominal: string;
  cardWidth?: number; // in cm
  cardHeight?: number; // in cm
  qrScale?: number; // 0.5 - 1.5, default 1
  fontSize?: number; // in px, default 14
  headerOffset?: number; // in px, positive = down
  footerOffset?: number; // in px, positive = up
  titleColor?: string;
  subtitleColor?: string;
  nmidColor?: string;
  footerCodeColor?: string;
  nominalColor?: string;
}

export const QRCard = ({
  title,
  subtitle,
  nmid,
  qrContent,
  footerCode,
  nominal,
  cardWidth = 12,
  cardHeight = 9.5,
  qrScale = 1,
  fontSize = 14,
  headerOffset = 0,
  footerOffset = 0,
  titleColor = '#000000',
  subtitleColor = '#333333',
  nmidColor = '#0066cc',
  footerCodeColor = '#0066cc',
  nominalColor = '#000000'
}: QRCardProps) => {
  // Calculate QR code size based on the smaller dimension and scale
  const minDimension = Math.min(cardWidth, cardHeight);
  const baseQrSize = Math.round(minDimension * 18);
  const qrSize = Math.round(baseQrSize * qrScale);

  return (
    <div
      className="flex flex-col items-center justify-between bg-white text-black font-sans box-border"
      style={{
        width: `${cardWidth}cm`,
        height: `${cardHeight}cm`,
        border: '1px solid #000',
        padding: '6px'
      }}
    >
      {/* Header Section */}
      <div
        className="text-center w-full"
        style={{
          lineHeight: 1.2,
          paddingTop: headerOffset > 0 ? `${headerOffset}px` : 0,
          marginTop: headerOffset < 0 ? `${headerOffset}px` : 0
        }}
      >
        <h1
          className="font-bold uppercase"
          style={{ fontSize: `${fontSize}px`, marginBottom: '1px', color: titleColor }}
        >
          {title}
        </h1>
        {subtitle && (
          <h2
            className="font-medium uppercase"
            style={{ fontSize: `${fontSize - 1}px`, marginBottom: '1px', color: subtitleColor }}
          >
            {subtitle}
          </h2>
        )}
        <p
          style={{ fontSize: `${fontSize - 2}px`, color: nmidColor }}
        >
          NMID: {nmid}
        </p>
      </div>

      {/* QR Code Section */}
      <div className="flex items-center justify-center flex-1 w-full" style={{ padding: '4px 0' }}>
        <QRCodeCanvas
          value={qrContent || "empty"}
          size={qrSize}
          level={"M"}
          includeMargin={false}
        />
      </div>

      {/* Footer Section */}
      <div
        className="text-center w-full"
        style={{
          lineHeight: 1.2,
          paddingBottom: footerOffset > 0 ? `${footerOffset}px` : 0,
          marginBottom: footerOffset < 0 ? `${footerOffset}px` : 0
        }}
      >
        {footerCode && (
          <p
            className="font-medium italic"
            style={{ fontSize: `${fontSize - 2}px`, marginBottom: '1px', color: footerCodeColor }}
          >
            {footerCode}
          </p>
        )}
        <p
          className="font-bold"
          style={{ fontSize: `${fontSize}px`, color: nominalColor }}
        >
          {nominal}
        </p>
      </div>
    </div>
  );
};
