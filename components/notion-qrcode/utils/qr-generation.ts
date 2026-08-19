import QRCodeGenerator from "qrcode-generator";

export const generateQRMatrix = (qrData: string): boolean[][] => {
  const qrCode = QRCodeGenerator(0, "H");
  qrCode.addData(qrData);
  qrCode.make();
  const size = qrCode.getModuleCount();

  const matrix: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      row.push(qrCode.isDark(y, x));
    }
    matrix.push(row);
  }

  return matrix;
};

export const getQRBlackModules = (
  matrix: boolean[][],
): { x: number; y: number }[] => {
  const modules: { x: number; y: number }[] = [];
  const size = matrix.length;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x]) {
        modules.push({ x, y });
      }
    }
  }

  return modules;
};
