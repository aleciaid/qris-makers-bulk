import { QRCodeCanvas } from 'qrcode.react';

interface QRCardProps {
  title: string;
  subtitle: string;
  nmid: string;
  qrContent: string;
  footerCode: string;
  nominal: string;
}

export const QRCard = ({ title, subtitle, nmid, qrContent, footerCode, nominal }: QRCardProps) => {
  return (
    <div className="w-[9cm] h-[9cm] border border-gray-300 flex flex-col items-center justify-between py-3 px-2 bg-white text-black font-sans box-border">
      {/* Header Section - Tight spacing like reference */}
      <div className="text-center w-full space-y-0">
        <h1 className="text-[14px] font-bold uppercase leading-tight text-black">{title}</h1>
        <h2 className="text-[15px] font-medium uppercase leading-tight text-black-700">{subtitle}</h2>
        <p className="text-[14px] leading-tight text-black-600">NMID: {nmid}</p>
      </div>

      {/* QR Code Section - Large, centered */}
      <div className="flex items-center justify-center flex-1 w-full py-1">
        <QRCodeCanvas
          value={qrContent || "empty"}
          size={210}
          level={"M"}
          includeMargin={false}
        />
      </div>

      {/* Footer Section - Tight spacing like reference */}
      <div className="text-center w-full space-y-0">
        <p className="text-[14px] font-medium italic leading-tight text-black-600">{footerCode}</p>
        <p className="text-[14px] font-bold leading-tight text-black">{nominal}</p>
      </div>
    </div>
  );
};
