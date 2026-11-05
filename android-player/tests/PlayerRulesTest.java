import com.viewsmidia.player.PlayerRules;
public final class PlayerRulesTest {
 static void eq(Object expected,Object actual){if(!expected.equals(actual))throw new AssertionError(expected+" != "+actual);}
 static void invalid(String url){try{PlayerRules.siteOrigin(url);throw new AssertionError("Accepted unsafe URL: "+url);}catch(IllegalArgumentException expected){}}
 public static void main(String[] args){
  eq("https://customer.chatgpt.site",PlayerRules.siteOrigin(" https://customer.chatgpt.site/ "));
  for(String url:new String[]{"http://customer.chatgpt.site","https://customer.chatgpt.site.evil.com","https://user:password@customer.chatgpt.site","https://customer.chatgpt.site/api/queue","https://customer.chatgpt.site/?key=secret","https://customer.chatgpt.site:444","file:///etc/passwd","https://127.0.0.1"})invalid(url);
  eq("https://project.supabase.co/functions/v1/tv-device",PlayerRules.deviceEndpoint("https://project.supabase.co/functions/v1/tv-device"));
  for(String value:new String[]{"http://project.supabase.co/functions/v1/tv-device","https://project.supabase.co.evil.com/functions/v1/tv-device","https://project.supabase.co/functions/v1/tv-device?secret=1","https://user:pass@project.supabase.co/functions/v1/tv-device"})try{PlayerRules.deviceEndpoint(value);throw new AssertionError("Unsafe endpoint accepted");}catch(IllegalArgumentException expected){}
  eq(true,PlayerRules.validMedia("12345678-1234-1234-1234-123456789012.mp4"));for(String name:new String[]{"../../settings.json","//evil.com/x.png","fake.mp4","12345678-1234-1234-1234-123456789012.svg"})eq(false,PlayerRules.validMedia(name));
  eq(5,PlayerRules.seconds(-1));eq(300,PlayerRules.seconds(900));eq(15,PlayerRules.seconds(15));
  eq(true,PlayerRules.stale(0,1));eq(false,PlayerRules.stale(1000,15999));eq(true,PlayerRules.stale(1000,16000));
  eq("Senha N 001. Guichê 1. Consultas. N 001",PlayerRules.announcement("Senha {senha}. {guiche}. {servico}. {senha}","N-001","Guichê 1","Consultas"));
  System.out.println("PASS: installation origin, auth navigation, safe filenames, playback bounds, stale calls and speech templates.");
 }
}
