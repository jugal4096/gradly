declare module "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.mjs" {
  export const getDocument: (source: unknown) => { promise: Promise<any> };
  export const GlobalWorkerOptions: { workerSrc: string };
}
