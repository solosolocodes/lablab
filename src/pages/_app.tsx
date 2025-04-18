import '@/app/globals.css';
import { AppProps } from 'next/app';

export default function CustomApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}