
import { cn } from "../@/lib/utils";
import Yolo from "../components/model/Yolo";



export default function RootLayout ( { children }: any )
{
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={ cn(
          "min-h-screen bg-background font-sans antialiased",
        ) }
      >
        <Yolo hasWebGL />
      </body>
    </html>
  );
}
