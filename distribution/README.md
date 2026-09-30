# Loupe

PDF, Word and image viewing in your app, with your own interface. One prebuilt package includes the core, three format adapters and optional React bindings.

## Install

Run this in your application:

```sh
npm install https://github.com/AndreiLocota/loupe/releases/download/v0.1.2/andreilocota-loupe-0.1.2.tgz
```

No GitHub account, repository clone or Loupe build is needed. Free for personal, commercial and production use. No separate approval is required. You may ship Loupe within your applications; standalone redistribution of the library, SDK or package is prohibited. Preserve the licence and copyright notices in permitted copies. See LICENSE for the complete terms.

## Open a Word file

In a browser app using Vite:

```html
<input id="file" type="file" accept=".docx,.docm" />
<div id="viewer" style="height: 75vh"></div>
```

```ts
import { ViewerStore } from '@andreilocota/loupe';
import { createDocxAdapterFactory } from '@andreilocota/loupe/docx';

const viewer = new ViewerStore();
viewer.registerFactory(createDocxAdapterFactory());
viewer.setMountElement(document.querySelector<HTMLElement>('#viewer')!);

document.querySelector<HTMLInputElement>('#file')!.onchange = async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    await viewer.loadDocument({ data: file, fileName: file.name }, { initialZoom: 'fit-page' });
  } catch (error) {
    console.error('Could not open document', error);
  }
};

// Call when your component unmounts:
// viewer.closeDocument();
// viewer.setMountElement(null);
```

For PDF use `createPdfAdapterFactory` from `@andreilocota/loupe/pdf`. For images use `createImageAdapterFactory` from `@andreilocota/loupe/image`. Register the adapters your app needs. React bindings are available from `@andreilocota/loupe/react`; install React and React DOM in the consuming app if using them. No API key or hosted backend is required at runtime.

## Runtime assets

Vite emits the package's worker and WASM assets. If your bundler needs explicit same-origin URLs, run:

```sh
npx loupe-assets public/loupe
```

Then pass `/loupe/pdf.worker.js` to the PDF factory, `{ tiffWorkerUrl: '/loupe/tiff.worker.js' }` to the image factory and `{ wasmUrl: '/loupe/docx_parser_bg.wasm' }` to the DOCX factory. Run the asset command again when upgrading Loupe.

Use your normal client-only component boundary in SSR applications: import document adapters in browser code, not in server-rendering code. The core is safe to import separately. The package does not add a toolbar or document forensics; those belong to your application.
