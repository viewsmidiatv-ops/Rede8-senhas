import com.google.zxing.*;
import com.google.zxing.common.*;
import com.google.zxing.qrcode.*;
public final class QrCodeTest {
 public static void main(String[] args)throws Exception{
  String uri="https://rede8-senhas-piloto.grupo-ortocd-0618.chatgpt.site/aparelhos?codigo=ABCD2345";
  BitMatrix matrix=new QRCodeWriter().encode(uri,BarcodeFormat.QR_CODE,400,400);int[] pixels=new int[400*400];for(int y=0;y<400;y++)for(int x=0;x<400;x++)pixels[y*400+x]=matrix.get(x,y)?0xff000000:0xffffffff;
  String decoded=new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(400,400,pixels)))).getText();if(!uri.equals(decoded))throw new AssertionError("QR payload mismatch");System.out.println("PASS: QR code pixel generation and decoding preserve the pairing URL and user code.");
 }
}
