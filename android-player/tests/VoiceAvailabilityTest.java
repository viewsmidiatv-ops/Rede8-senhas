import com.viewsmidia.player.VoiceAvailability;
public final class VoiceAvailabilityTest {
 static void require(boolean condition){if(!condition)throw new AssertionError();}
 public static void main(String[] args){
  require(VoiceAvailability.message(true,false,0,-2).contains("Preparando"));
  require(VoiceAvailability.message(false,false,0,-2).contains("Nenhum mecanismo"));
  require(VoiceAvailability.message(false,false,1,-2).contains("encontrado"));
  require(VoiceAvailability.message(false,true,1,-1).contains("dados de voz"));
  require(VoiceAvailability.message(false,true,1,-2).contains("não oferece português"));
  require(!VoiceAvailability.ready(false,2));require(!VoiceAvailability.ready(true,-1));require(!VoiceAvailability.ready(true,-2));
  for(int available=0;available<=2;available++){require(VoiceAvailability.ready(true,available));require(VoiceAvailability.message(false,true,1,available).isEmpty());}
  System.out.println("PASS: initializing, absent engine, failed connection and missing/unsupported Portuguese are distinguished.");
 }
}
