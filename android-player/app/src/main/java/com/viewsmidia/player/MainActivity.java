package com.viewsmidia.player;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.speech.tts.UtteranceProgressListener;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.common.BitMatrix;




import android.widget.*;
import org.json.*;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.net.URL;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Native read-only TV player. Pairing uses a short-lived code approved by an administrator. */
public class MainActivity extends Activity {
    private static final String DEFAULT_ENDPOINT="https://vhsihfbhxqrxtkyfyebr.supabase.co/functions/v1/tv-device";
    private static final String DEFAULT_SITE="https://rede8-senhas-piloto.grupo-ortocd-0618.chatgpt.site";
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService network=Executors.newSingleThreadScheduledExecutor();
    private final ExecutorService downloads=Executors.newSingleThreadExecutor();
    private final AtomicBoolean syncing=new AtomicBoolean(false);
    private ScheduledFuture<?> pollTask,pairTask;
    private volatile String deviceEndpoint=DEFAULT_ENDPOINT;
    private TokenStore tokens;
    private boolean pairingMode=false;
    private TextView pairingStatus;
    private SharedPreferences prefs;
    private volatile String origin="", desiredMedia="", playingId="";
    private volatile int generation=0;
    private volatile boolean resumed=false, playerMode=false, destroyed=false;
    private File mediaDir;
    private JSONObject settings=new JSONObject();
    private JSONArray events=new JSONArray(),counters=new JSONArray();
    private TextToSpeech tts;
    private boolean voiceReady=false, voiceInitialized=false, voiceInitializing=false, refreshVoice=false, authNeeded=false, mediaReady=false;
    private int voiceGeneration=0,voiceLanguage=TextToSpeech.LANG_NOT_SUPPORTED;
    private long seen=-1,lastSuccess=0,lastMediaAttempt=0;
    private String mediaSignature="",renderSignature="",appliedSettings="",speechStatus="",cacheStatus="";
    private int playlistIndex=0;
    private final ArrayList<JSONObject> playlist=new ArrayList<>();
    private LinearLayout root,body,ticketColumn;
    private FrameLayout mediaFrame;
    private TextView brand,status,code,counter,history,message,clock;
    private VideoView video;
    
    private Bitmap bitmap;
    private ToneGenerator tone;
    private final Runnable advance=new Runnable(){@Override public void run(){playNext();}};
    private final Runnable tick=new Runnable(){@Override public void run(){if(destroyed)return;if(playerMode){renderCalls();}ui.postDelayed(this,1000);}};

    @Override public void onCreate(Bundle state){
        super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);immersive();
        prefs=getSharedPreferences("views-tv",MODE_PRIVATE);tokens=new TokenStore(this);deviceEndpoint=prefs.getString("deviceEndpoint",DEFAULT_ENDPOINT);origin=prefs.getString("origin",DEFAULT_SITE);setMediaDir();
        setVolumeControlStream(AudioManager.STREAM_MUSIC);initializeVoice();
        try{tone=new ToneGenerator(AudioManager.STREAM_MUSIC,50);}catch(RuntimeException ignored){}
        if(prefs.getBoolean("authorized",false)&&!tokens.get(deviceEndpoint).isEmpty())openPlayer();else showSetup();ui.post(tick);
    }
    private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);}
    private void setMediaDir(){try{byte[] hash=MessageDigest.getInstance("SHA-256").digest(origin.getBytes("UTF-8"));StringBuilder b=new StringBuilder();for(int i=0;i<12;i++)b.append(String.format(Locale.ROOT,"%02x",hash[i]));mediaDir=new File(getFilesDir(),"media-"+b);mediaDir.mkdirs();}catch(Exception e){throw new IllegalStateException(e);}}
    private int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private TextView text(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextColor(Color.WHITE);v.setTextSize(size);v.setGravity(Gravity.CENTER);v.setPadding(dp(8),dp(5),dp(8),dp(5));return v;}
    private Button button(String label,Runnable action){Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setOnClickListener(v->action.run());return b;}
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);l.setGravity(Gravity.CENTER);return l;}
    private void stopPlayer(){playerMode=false;stopPoll();stopMedia();if(tts!=null)tts.stop();}
    private void stopPairing(){pairingMode=false;if(pairTask!=null){pairTask.cancel(true);pairTask=null;}}
    private void showSetup(){
        stopPairing();stopPlayer();generation++;seen=-1;lastSuccess=0;authNeeded=false;
        LinearLayout layout=column();layout.setPadding(dp(30),dp(10),dp(30),dp(10));layout.setBackgroundColor(Color.rgb(52,46,78));
        layout.addView(text("Views TV · Ativação por código",25));layout.addView(text("Autorize esta TV pelo celular ou pelo computador.",14));
        EditText label=new EditText(this);label.setSingleLine(true);label.setTextColor(Color.WHITE);label.setText(prefs.getString("deviceLabel","TV da recepção"));layout.addView(label,new LinearLayout.LayoutParams(-1,dp(48)));
        layout.addView(button("Gerar QR code e código de ativação",()->{String name=label.getText().toString().trim();if(name.isEmpty()||name.length()>80){Toast.makeText(this,"Informe um nome de até 80 caracteres.",Toast.LENGTH_LONG).show();return;}prefs.edit().putString("deviceLabel",name).apply();startPairing(name);}));
        if(!tokens.get(deviceEndpoint).isEmpty())layout.addView(button("Abrir player / continuar mídias locais",this::openPlayer));
        layout.addView(button("Configurar conexão do cliente",this::configureConnection));
        layout.addView(text("O código expira em dez minutos. Você não precisa digitar sua conta nesta TV.",13));setContentView(layout);immersive();
    }
    private void configureConnection(){
        LinearLayout fields=column();EditText site=new EditText(this),endpoint=new EditText(this);site.setSingleLine(true);endpoint.setSingleLine(true);site.setText(origin);endpoint.setText(deviceEndpoint);fields.addView(text("URL do painel administrativo",13));fields.addView(site);fields.addView(text("URL de conexão do aparelho (Supabase)",13));fields.addView(endpoint);
        new AlertDialog.Builder(this).setTitle("Conexão do cliente").setView(fields).setNegativeButton("Cancelar",null).setPositiveButton("Salvar",(d,w)->{try{String selected=PlayerRules.siteOrigin(site.getText().toString()),api=PlayerRules.deviceEndpoint(endpoint.getText().toString());if(!selected.equals(origin)||!api.equals(deviceEndpoint)){stopPlayer();stopPairing();generation++;origin=selected;deviceEndpoint=api;setMediaDir();settings=new JSONObject();playlist.clear();mediaSignature="";renderSignature="";prefs.edit().putString("origin",origin).putString("deviceEndpoint",deviceEndpoint).putBoolean("authorized",false).apply();}showSetup();}catch(IllegalArgumentException e){Toast.makeText(this,e.getMessage(),Toast.LENGTH_LONG).show();}}).show();
    }
    private HttpsURLConnection deviceRequest(String endpoint,String path,String token)throws Exception{
        HttpsURLConnection c=(HttpsURLConnection)new URL(endpoint+path).openConnection();c.setInstanceFollowRedirects(false);c.setUseCaches(false);c.setRequestProperty("Cache-Control","no-store");c.setRequestProperty("Accept","application/json");c.setConnectTimeout(10000);c.setReadTimeout(15000);if(token!=null&&!token.isEmpty())c.setRequestProperty("Authorization","Bearer "+token);return c;
    }
    private void startPairing(String name){
        stopPlayer();stopPairing();int epoch=++generation;LinearLayout loading=column();loading.setBackgroundColor(Color.rgb(52,46,78));loading.addView(text("Gerando código seguro…",24));setContentView(loading);String endpoint=deviceEndpoint;
        network.execute(()->{HttpsURLConnection c=null;try{c=deviceRequest(endpoint,"/pair/start",null);c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");JSONObject input=new JSONObject();input.put("label",name);input.put("instance","rede8");try(OutputStream out=c.getOutputStream()){out.write(input.toString().getBytes("UTF-8"));}if(c.getResponseCode()!=200)throw new IOException("Não foi possível gerar o código. Confira a conexão ou tente mais tarde.");JSONObject result=new JSONObject(response(c,10000));String token=result.getString("deviceToken");if(!token.matches("[a-f0-9]{64}"))throw new IOException("Resposta inválida");String verification=result.getString("verificationUriComplete");if(!verification.startsWith(origin+"/aparelhos?codigo="))throw new IOException("O painel informado não corresponde a esta instalação.");if(destroyed||epoch!=generation)return;tokens.put(endpoint,token);ui.post(()->{if(epoch==generation){prefs.edit().putBoolean("authorized",false).apply();showPairing(result);}});}catch(Exception e){ui.post(()->{if(epoch==generation){showSetup();new AlertDialog.Builder(this).setTitle("Ativação indisponível").setMessage(e.getMessage()).setPositiveButton("OK",null).show();}});}finally{if(c!=null)c.disconnect();}});
    }
    private void showPairing(JSONObject data){
        stopPairing();pairingMode=true;generation++;LinearLayout layout=column();layout.setBackgroundColor(Color.rgb(52,46,78));layout.addView(text("Autorize esta TV no seu painel",23));LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER);ImageView qr=new ImageView(this);
        try{BitMatrix matrix=new QRCodeWriter().encode(data.getString("verificationUriComplete"),BarcodeFormat.QR_CODE,400,400);Bitmap image=Bitmap.createBitmap(400,400,Bitmap.Config.RGB_565);for(int y=0;y<400;y++)for(int x=0;x<400;x++)image.setPixel(x,y,matrix.get(x,y)?Color.BLACK:Color.WHITE);qr.setImageBitmap(image);}catch(Exception ignored){}
        row.addView(qr,new LinearLayout.LayoutParams(dp(220),dp(220)));LinearLayout words=column();String value=data.optString("code");words.addView(text(value.length()==8?value.substring(0,4)+"-"+value.substring(4):value,36));words.addView(text("Leia o QR code com o celular ou abra\no painel → Aparelhos da TV e informe o código.",16));words.addView(text("Confira o código antes de autorizar.",13));row.addView(words,new LinearLayout.LayoutParams(dp(390),-2));layout.addView(row);pairingStatus=text("Aguardando sua autorização · código válido por dez minutos",14);layout.addView(pairingStatus);layout.addView(button("Voltar / gerar outro código",this::showSetup));setContentView(layout);immersive();startPairPoll();
    }
    private void startPairPoll(){if(!resumed||!pairingMode||destroyed||pairTask!=null)return;final int epoch=generation;final String endpoint=deviceEndpoint;pairTask=network.scheduleWithFixedDelay(()->{HttpsURLConnection c=null;try{c=deviceRequest(endpoint,"/pair/status",tokens.get(endpoint));int http=c.getResponseCode();if(http==410||http==401){ui.post(()->{if(epoch==generation){stopPairing();pairingStatus.setText("Código expirado ou inválido. Volte para gerar outro código.");}});return;}if(http!=200)throw new IOException();JSONObject data=new JSONObject(response(c,10000));if("approved".equals(data.optString("status")))ui.post(()->{if(epoch==generation&&resumed){stopPairing();prefs.edit().putBoolean("authorized",true).apply();openPlayer();}});}catch(Exception e){ui.post(()->{if(epoch==generation&&pairingStatus!=null)pairingStatus.setText("Sem conexão · aguardando para conferir a autorização…");});}finally{if(c!=null)c.disconnect();}},0,5,TimeUnit.SECONDS);}
    private void openPlayer(){
        stopPairing();stopPlayer();playerMode=true;generation++;seen=-1;lastSuccess=0;events=new JSONArray();counters=new JSONArray();authNeeded=false;renderSignature="";
        try{File file=new File(mediaDir,"settings.json");if(file.exists())settings=new JSONObject(readFile(file,1024*1024));}catch(Exception ignored){settings=new JSONObject();}
        buildScreen();updateSettings(settings);rebuildPlaylist();renderCalls();startPoll();
    }
    private void buildScreen(){
        appliedSettings="";
        root=column();root.setPadding(dp(18),dp(6),dp(18),dp(6));root.setBackgroundColor(parseColor(settings.optString("primaryColor"),Color.rgb(52,46,78)));
        LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);brand=text(settings.optString("name","Views TV"),22);brand.setGravity(Gravity.LEFT|Gravity.CENTER_VERTICAL);header.addView(brand,new LinearLayout.LayoutParams(0,-2,1));clock=text("",14);header.addView(clock);header.addView(button("Opções",this::showOptions));root.addView(header);
        body=new LinearLayout(this);body.setGravity(Gravity.CENTER);root.addView(body,new LinearLayout.LayoutParams(-1,0,1));ticketColumn=column();body.addView(ticketColumn,new LinearLayout.LayoutParams(0,-1,1));
        ticketColumn.addView(text("ÚLTIMA SENHA CHAMADA",13));code=text("—",70);code.setTypeface(android.graphics.Typeface.MONOSPACE,android.graphics.Typeface.BOLD);ticketColumn.addView(code);counter=text("Aguarde a primeira chamada",25);ticketColumn.addView(counter);message=text("",13);ticketColumn.addView(message);history=text("",15);ticketColumn.addView(history);
        mediaFrame=new FrameLayout(this);mediaFrame.setBackgroundColor(Color.BLACK);body.addView(mediaFrame,new LinearLayout.LayoutParams(0,-1,1));status=text("Conectando…",12);root.addView(status);setContentView(root);immersive();
    }
    private int parseColor(String value,int fallback){try{return Color.parseColor(value);}catch(Exception e){return fallback;}}
    private void updateSettings(JSONObject cfg){
        String signature=cfg.toString();if(signature.equals(appliedSettings))return;appliedSettings=signature;settings=cfg;
        final File configDir=mediaDir;final int configEpoch=generation;downloads.execute(()->{if(configEpoch==generation&&!destroyed)try{writeAtomic(new File(configDir,"settings.json"),signature);}catch(Exception ignored){}});
        brand.setText(cfg.optString("name","Views TV"));root.setBackgroundColor(parseColor(cfg.optString("primaryColor"),Color.rgb(52,46,78)));message.setText(cfg.optJSONObject("texts")!=null?cfg.optJSONObject("texts").optString("displayMessage",""):"");
        JSONObject indoor=cfg.optJSONObject("indoor");boolean enabled=indoor!=null&&indoor.optBoolean("enabled",false);int percent=indoor==null?60:indoor.optInt("mediaPercent",60);percent=Math.max(50,Math.min(70,percent));mediaFrame.setVisibility(enabled?View.VISIBLE:View.GONE);ticketColumn.setLayoutParams(new LinearLayout.LayoutParams(0,-1,enabled?100-percent:100));mediaFrame.setLayoutParams(new LinearLayout.LayoutParams(0,-1,percent));body.removeView(mediaFrame);body.addView(mediaFrame,indoor!=null&&"left".equals(indoor.optString("position"))?0:body.getChildCount());code.setTextSize(enabled?54:78);
        history.setVisibility("compact".equals(cfg.optString("displayLayout"))?View.GONE:View.VISIBLE);
        String sig=indoor==null?"":indoor.toString();if(!sig.equals(mediaSignature)){mediaSignature=sig;desiredMedia=sig;lastMediaAttempt=0;rebuildPlaylist();}
    }
    private void renderCalls(){
        if(!playerMode||status==null)return;boolean stale=PlayerRules.stale(lastSuccess,SystemClock.elapsedRealtime());
        java.text.SimpleDateFormat fmt=new java.text.SimpleDateFormat("dd/MM/yyyy  HH:mm",new Locale("pt","BR"));fmt.setTimeZone(TimeZone.getTimeZone("America/Bahia"));clock.setText(settings.optBoolean("showClock",true)?fmt.format(new Date()):"");
        if(stale){code.setText("—");counter.setText(authNeeded?"Autorize o aparelho novamente nas opções":"Sem conexão para novas chamadas");history.setText("");}
        else {JSONObject event=events.optJSONObject(events.length()-1);code.setText(event==null?"—":event.optString("code","—"));counter.setText(event==null?"Aguarde a primeira chamada":event.optString("counter",""));StringBuilder h=new StringBuilder();int count=Math.max(1,Math.min(8,settings.optInt("historyCount",5)));for(int i=events.length()-1;i>=Math.max(0,events.length()-count);i--){JSONObject e=events.optJSONObject(i);if(e!=null)h.append(e.optString("code")).append("  ·  ").append(e.optString("counter")).append('\n');}history.setText(h.toString().trim());}
        status.setText((stale?(authNeeded?"Autorização necessária":"Sem atualização · mídias locais continuam"):"Conectado · chamadas em tempo real")+(cacheStatus.isEmpty()?"":"  |  "+cacheStatus)+(speechStatus.isEmpty()?"":"  |  "+speechStatus));
    }
    private void startPoll(){if(!resumed||!playerMode||destroyed||pollTask!=null)return;final int epoch=generation;pollTask=network.scheduleWithFixedDelay(()->poll(epoch),0,2,TimeUnit.SECONDS);}
    private void stopPoll(){if(pollTask!=null){pollTask.cancel(true);pollTask=null;}}
    private HttpsURLConnection connection(String site,String path,String token)throws Exception{
        if(!path.equals("/api/queue")&&!path.startsWith("/api/media/"))throw new IOException("Endpoint inválido");
        return deviceRequest(site,path.equals("/api/queue")?"/state":path.replace("/api/media/","/media/"),token);
    }
    private String response(HttpsURLConnection c,int limit)throws Exception{try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>limit)throw new IOException("Resposta grande demais");out.write(buffer,0,n);}return out.toString("UTF-8");}}
    private void poll(int epoch){
        if(!playerMode||!resumed||destroyed||epoch!=generation)return;
        HttpsURLConnection c=null;try{String site=deviceEndpoint;String cookies=tokens.get(site);c=connection(site,"/api/queue",cookies);int http=c.getResponseCode();if(http==401||http==403||http==302||http==303||!(c.getContentType()!=null&&c.getContentType().contains("application/json"))){ui.post(()->{if(epoch==generation){authNeeded=true;renderCalls();}});return;}if(http!=200)throw new IOException("HTTP "+http);JSONObject snap=new JSONObject(response(c,1024*1024));JSONObject cfg=snap.getJSONObject("settings"),queue=snap.getJSONObject("queue");
            ui.post(()->{if(epoch!=generation||!playerMode||!resumed)return;boolean wasStale=PlayerRules.stale(lastSuccess,SystemClock.elapsedRealtime());authNeeded=false;lastSuccess=SystemClock.elapsedRealtime();updateSettings(cfg);events=queue.optJSONArray("events");if(events==null)events=new JSONArray();long sequence=queue.optLong("eventSequence",0);
                if(seen>=0&&!wasStale&&sequence>seen){for(int i=0;i<events.length();i++){JSONObject event=events.optJSONObject(i);if(event!=null&&event.optLong("id")>seen)speak(event);}}seen=sequence;renderCalls();syncMedia(epoch,site,cookies);
            });
        }catch(Exception ignored){ui.post(()->{if(epoch==generation)renderCalls();});}finally{if(c!=null)c.disconnect();}
    }
    private void syncMedia(int epoch,String site,String cookies){
        if(SystemClock.elapsedRealtime()-lastMediaAttempt<30000||syncing.get())return;JSONObject indoor=settings.optJSONObject("indoor");if(indoor==null||!indoor.optBoolean("enabled"))return;
        final String signature=desiredMedia;final JSONObject config;try{config=new JSONObject(settings.toString());}catch(Exception e){return;}
        final File dir=mediaDir;lastMediaAttempt=SystemClock.elapsedRealtime();syncing.set(true);cacheStatus="Conferindo mídias…";
        downloads.execute(()->{int ok=0,failed=0;HashSet<String> keep=new HashSet<>();JSONArray items=config.optJSONObject("indoor").optJSONArray("items");if(items==null)items=new JSONArray();
            for(int i=0;i<Math.min(30,items.length());i++){JSONObject item=items.optJSONObject(i);if(item!=null&&item.optBoolean("enabled")&&PlayerRules.validMedia(item.optString("id")))keep.add(item.optString("id"));}
            for(File f:list(dir)){if(!f.getName().equals("settings.json")&&!keep.contains(f.getName())&&!f.getName().equals(playingId))f.delete();}
            for(int i=0;i<Math.min(30,items.length());i++){
                if(destroyed||epoch!=generation||!signature.equals(desiredMedia))break;JSONObject item=items.optJSONObject(i);if(item==null||!item.optBoolean("enabled"))continue;String id=item.optString("id");if(!PlayerRules.validMedia(id)||!item.optString("url").equals("/api/media/"+id)){failed++;continue;}File target=new File(dir,id);if(target.isFile()&&target.length()>0){ok++;continue;}
                try{downloadMedia(site,id,target,cookies,dir,epoch,signature);ok++;}catch(Exception e){failed++;}
            }
            final int ready=ok,errors=failed;
            if(!destroyed&&epoch==generation&&signature.equals(desiredMedia)){try{writeAtomic(new File(dir,"settings.json"),config.toString());}catch(Exception ignored){}ui.post(()->{if(epoch==generation&&playerMode){cacheStatus=ready+" mídia(s) local(is)"+(errors>0?" · "+errors+" pendente(s)":"");rebuildPlaylist();renderCalls();}});}
            syncing.set(false);
        });
    }
    private static File[] list(File dir){File[] files=dir.listFiles();return files==null?new File[0]:files;}
    private void downloadMedia(String site,String id,File target,String cookies,File dir,int epoch,String signature)throws Exception{
        HttpsURLConnection c=null;File temp=new File(dir,id+".part");try{c=connection(site,"/api/media/"+id,cookies);if(c.getResponseCode()!=200)throw new IOException("Sem autorização ou mídia ausente");String content=c.getContentType();boolean videoFile=id.endsWith(".mp4")||id.endsWith(".webm");if(content==null||!content.startsWith(videoFile?"video/":"image/"))throw new IOException("Formato inválido");if(c.getContentLengthLong()>PlayerRules.MAX_FILE)throw new IOException("Arquivo muito grande");long total=0;for(File f:list(dir))total+=f.length();long available=PlayerRules.MAX_CACHE-total;if(dir.getUsableSpace()<PlayerRules.MAX_FILE+32L*1024*1024||available<=0)throw new IOException("Sem espaço");
            try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(temp)){byte[] buf=new byte[65536];int n;long size=0;while((n=in.read(buf))!=-1){if(destroyed||epoch!=generation||!signature.equals(desiredMedia))throw new IOException("Cancelado");size+=n;if(size>PlayerRules.MAX_FILE||size>available)throw new IOException("Limite de armazenamento");out.write(buf,0,n);}if(size==0)throw new IOException("Arquivo vazio");out.getFD().sync();}
            if(destroyed||epoch!=generation||!signature.equals(desiredMedia))throw new IOException("Cancelado");if(!temp.renameTo(target))throw new IOException("Falha ao concluir download");
        }finally{temp.delete();if(c!=null)c.disconnect();}
    }
    private static String readFile(File file,int limit)throws IOException{try(InputStream in=new FileInputStream(file);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>limit)throw new IOException("Configuração inválida");out.write(b,0,n);}return out.toString("UTF-8");}}
    private static void writeAtomic(File file,String value)throws IOException{File tmp=new File(file.getParentFile(),file.getName()+".part");try(FileOutputStream out=new FileOutputStream(tmp)){out.write(value.getBytes("UTF-8"));out.getFD().sync();}if(!tmp.renameTo(file))throw new IOException("Falha ao gravar configuração");}
    private void rebuildPlaylist(){
        JSONObject indoor=settings.optJSONObject("indoor");JSONArray source=indoor==null?null:indoor.optJSONArray("items");ArrayList<JSONObject> next=new ArrayList<>();StringBuilder sig=new StringBuilder();if(indoor!=null&&indoor.optBoolean("enabled")&&source!=null)for(int i=0;i<Math.min(30,source.length());i++){JSONObject item=source.optJSONObject(i);if(item!=null&&item.optBoolean("enabled")&&PlayerRules.validMedia(item.optString("id"))&&new File(mediaDir,item.optString("id")).isFile()){next.add(item);sig.append(item.toString());}}
        sig.append(indoor==null?"":indoor.optString("fit"));if(sig.toString().equals(renderSignature)&&mediaReady)return;renderSignature=sig.toString();stopMedia();playlist.clear();playlist.addAll(next);playlistIndex=0;mediaReady=true;if(!playlist.isEmpty())playNext();else if(mediaFrame!=null&&mediaFrame.getVisibility()==View.VISIBLE)mediaFrame.addView(text("Aguardando download dos conteúdos",17),new FrameLayout.LayoutParams(-1,-1));
    }
    private void stopMedia(){ui.removeCallbacks(advance);if(video!=null){video.stopPlayback();video=null;}if(mediaFrame!=null)mediaFrame.removeAllViews();if(bitmap!=null){bitmap.recycle();bitmap=null;}playingId="";mediaReady=false;}
    private void playNext(){
        if(!playerMode||!resumed||playlist.isEmpty()||destroyed)return;ui.removeCallbacks(advance);if(video!=null){video.stopPlayback();video=null;}mediaFrame.removeAllViews();if(bitmap!=null){bitmap.recycle();bitmap=null;}
        JSONObject item=playlist.get(playlistIndex%playlist.size());playlistIndex=(playlistIndex+1)%playlist.size();String id=item.optString("id");playingId=id;File file=new File(mediaDir,id);JSONObject indoor=settings.optJSONObject("indoor");boolean cover=indoor!=null&&"cover".equals(indoor.optString("fit"));
        if(id.endsWith(".mp4")||id.endsWith(".webm")){
            video=new VideoView(this);FrameLayout.LayoutParams params=new FrameLayout.LayoutParams(-1,-1,Gravity.CENTER);mediaFrame.addView(video,params);video.setVideoURI(Uri.fromFile(file));video.setOnPreparedListener(mp->{mp.setVolume(0,0);mp.setLooping(false);if(cover){float vw=mp.getVideoWidth(),vh=mp.getVideoHeight();if(vw>0&&vh>0&&mediaFrame.getHeight()>0){float viewRatio=(float)mediaFrame.getWidth()/mediaFrame.getHeight(),ratio=vw/vh;video.setScaleX(ratio>viewRatio?ratio/viewRatio:1);video.setScaleY(ratio<viewRatio?viewRatio/ratio:1);}}video.start();});video.setOnCompletionListener(mp->{ui.removeCallbacks(advance);ui.post(advance);});video.setOnErrorListener((mp,what,extra)->{cacheStatus="Vídeo incompatível · tentando próximo conteúdo";ui.removeCallbacks(advance);ui.postDelayed(advance,3000);return true;});ui.postDelayed(advance,300000);
        }else{
            try{BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getAbsolutePath(),bounds);int sample=1;while(bounds.outWidth/sample>1920||bounds.outHeight/sample>1080)sample*=2;BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=sample;bitmap=BitmapFactory.decodeFile(file.getAbsolutePath(),options);if(bitmap==null)throw new IOException("Imagem incompatível");ImageView image=new ImageView(this);image.setScaleType(cover?ImageView.ScaleType.CENTER_CROP:ImageView.ScaleType.FIT_CENTER);image.setImageBitmap(bitmap);mediaFrame.addView(image,new FrameLayout.LayoutParams(-1,-1));ui.postDelayed(advance,PlayerRules.seconds(item.optInt("seconds",15))*1000L);}catch(Exception e){mediaFrame.addView(text("Imagem indisponível",16));ui.postDelayed(advance,3000);}
        }
    }
    private int installedEngineCount(){return getPackageManager().queryIntentServices(new Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE),0).size();}
    private void initializeVoice(){
        final int epoch=++voiceGeneration;voiceReady=false;voiceInitialized=false;voiceInitializing=true;speechStatus=VoiceAvailability.message(true,false,0,voiceLanguage);
        if(tts!=null){tts.shutdown();tts=null;}
        TextToSpeech.OnInitListener listener=result->ui.post(()->{if(destroyed||epoch!=voiceGeneration)return;voiceInitializing=false;voiceInitialized=result==TextToSpeech.SUCCESS;if(voiceInitialized){
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){public void onStart(String id){}public void onDone(String id){}public void onError(String id){ui.post(()->{if(epoch==voiceGeneration&&!destroyed){speechStatus="Falha ao reproduzir a voz. Verifique os dados e o mecanismo nas opções.";renderCalls();}});}});
            prepareVoice();
        }else{speechStatus=VoiceAvailability.message(false,false,installedEngineCount(),voiceLanguage);}renderCalls();});
        try{String engine=prefs.getString("androidEngine","");tts=engine.isEmpty()?new TextToSpeech(this,listener):new TextToSpeech(this,listener,engine);}catch(RuntimeException e){voiceInitializing=false;speechStatus=VoiceAvailability.message(false,false,installedEngineCount(),voiceLanguage);}
    }
    private boolean prepareVoice(){
        if(!voiceInitialized||tts==null)return false;voiceLanguage=tts.setLanguage(new Locale("pt","BR"));voiceReady=VoiceAvailability.ready(true,voiceLanguage);speechStatus=VoiceAvailability.message(false,true,1,voiceLanguage);if(!voiceReady)return false;
        JSONObject cfg=settings.optJSONObject("voice");tts.setSpeechRate((float)Math.max(.6,Math.min(1.4,cfg==null?.9:cfg.optDouble("rate",.9))));String selected=prefs.getString("androidVoice","");Set<Voice> values=tts.getVoices();if(values!=null)for(Voice v:values)if(v.getName().equals(selected)){tts.setVoice(v);break;}return true;
    }
    private void speak(JSONObject event){
        if(!voiceInitialized||!prepareVoice()){if(!voiceInitializing&&speechStatus.isEmpty())speechStatus=VoiceAvailability.message(false,false,installedEngineCount(),voiceLanguage);return;}
        JSONObject voice=settings.optJSONObject("voice"),texts=settings.optJSONObject("texts");if(voice==null||texts==null)return;float volume=(float)Math.max(0,Math.min(1,voice.optDouble("volume",1)));
        String template=texts.optString(event.optBoolean("recall")?"recallCall":"nextCall","Senha {senha}, dirija-se ao {guiche}.");String phrase=PlayerRules.announcement(template,event.optString("code"),event.optString("counter"),event.optString("serviceName","Atendimento"));Bundle params=new Bundle();params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,volume);
        if(volume>0&&tone!=null&&!"none".equals(voice.optString("chime"))){tone.startTone(ToneGenerator.TONE_PROP_BEEP,200);if("double".equals(voice.optString("chime")))ui.postDelayed(()->{if(playerMode&&tone!=null)tone.startTone(ToneGenerator.TONE_PROP_BEEP,200);},250);}
        if(tts.speak(phrase,TextToSpeech.QUEUE_ADD,params,"call-"+event.optLong("id"))==TextToSpeech.ERROR)speechStatus="Falha na voz Android. Verifique o mecanismo nas opções.";
    }
    private void testVoice(){
        if(!voiceInitialized||!prepareVoice()){showVoiceHelp();return;}JSONObject cfg=settings.optJSONObject("voice");float volume=(float)Math.max(0,Math.min(1,cfg==null?1:cfg.optDouble("volume",1)));if(volume==0){Toast.makeText(this,"O volume da voz está em zero nas configurações do painel.",Toast.LENGTH_LONG).show();return;}Bundle params=new Bundle();params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,volume);if(tts.speak("Senha N zero zero um. Dirija-se ao guichê um.",TextToSpeech.QUEUE_FLUSH,params,"voice-test")==TextToSpeech.ERROR)showVoiceHelp();
    }
    private void showOptions(){
        new AlertDialog.Builder(this).setTitle("Views TV · Opções").setItems(new String[]{"Continuar reprodução","Ativar / renovar autorização","Escolher voz Android","Testar voz","Configurar URL do cliente","Sair da conta e apagar mídias locais","Mecanismo e ajuda de voz"},(d,index)->{switch(index){case 1:showSetup();break;case 2:chooseVoice();break;case 3:testVoice();break;case 4:showSetup();break;case 5:confirmLogout();break;case 6:showVoiceHelp();break;default:immersive();}}).show();
    }
    private void showVoiceHelp(){
        String detail=voiceInitializing?"O mecanismo ainda está iniciando. Aguarde alguns segundos.":speechStatus;
        if(detail.isEmpty())detail="A voz está pronta. Você pode escolher outro mecanismo, verificar os dados de português ou reconectar.";
        LinearLayout content=column();content.setPadding(dp(16),dp(8),dp(16),dp(8));content.addView(text(detail+"\n\nO aparelho precisa de um mecanismo de síntese instalado e habilitado, com dados de português. Depois de instalar ou alterar a voz, volte ao aplicativo e reconecte.",14));ScrollView scroll=new ScrollView(this);scroll.addView(content);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Mecanismo e ajuda de voz").setView(scroll).setNegativeButton("Voltar",null).create();
        content.addView(button("Selecionar mecanismo instalado",()->{dialog.dismiss();chooseEngine();}));
        content.addView(button("Verificar dados de voz",()->{dialog.dismiss();openVoiceActivity(TextToSpeech.Engine.ACTION_CHECK_TTS_DATA);}));
        content.addView(button("Instalar dados de voz",()->{dialog.dismiss();openVoiceActivity(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);}));
        content.addView(button("Abrir configurações do Android",()->{dialog.dismiss();refreshVoice=true;try{startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS));}catch(ActivityNotFoundException e){Toast.makeText(this,"Abra as configurações do Android pelo controle do aparelho.",Toast.LENGTH_LONG).show();}}));
        content.addView(button("Reconectar mecanismo de voz",()->{dialog.dismiss();initializeVoice();}));dialog.show();
    }

    private void openVoiceActivity(String action){
        Intent intent=new Intent(action);String engine=prefs.getString("androidEngine","");if(!engine.isEmpty())intent.setPackage(engine);refreshVoice=true;try{startActivity(intent);}catch(ActivityNotFoundException e){Toast.makeText(this,"Nenhum verificador ou instalador de voz foi encontrado. Abra as configurações ou a loja do aparelho para instalar um mecanismo de síntese.",Toast.LENGTH_LONG).show();}
    }
    private void chooseEngine(){
        List<TextToSpeech.EngineInfo> engines=tts==null?new ArrayList<>():tts.getEngines();if(engines==null||engines.isEmpty()){new AlertDialog.Builder(this).setTitle("Nenhum mecanismo encontrado").setMessage("Instale ou habilite um mecanismo de síntese de voz em português nas configurações ou na loja do aparelho. A instalação dos dados exige um mecanismo instalado.").setPositiveButton("Configurações Android",(d,w)->{refreshVoice=true;try{startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS));}catch(ActivityNotFoundException ignored){}}).setNegativeButton("Voltar",null).show();return;}
        String[] names=new String[engines.size()+1];names[0]="Usar o mecanismo padrão do Android";for(int i=0;i<engines.size();i++)names[i+1]=engines.get(i).label;
        new AlertDialog.Builder(this).setTitle("Mecanismo de voz").setItems(names,(d,i)->{prefs.edit().putString("androidEngine",i==0?"":engines.get(i-1).name).remove("androidVoice").apply();initializeVoice();}).show();
    }
    private void chooseVoice(){
        if(!voiceInitialized||!prepareVoice()){showVoiceHelp();return;}ArrayList<Voice> values=new ArrayList<>();Set<Voice> available=tts.getVoices();if(available!=null)for(Voice v:available)if(v.getLocale().getLanguage().equals("pt"))values.add(v);Collections.sort(values,(a,b)->a.getName().compareTo(b.getName()));String[] names=new String[values.size()+1];names[0]="Automática — português do mecanismo";for(int i=0;i<values.size();i++)names[i+1]=values.get(i).getName()+(values.get(i).isNetworkConnectionRequired()?" · requer internet":" · local");new AlertDialog.Builder(this).setTitle("Voz deste aparelho").setItems(names,(d,i)->{prefs.edit().putString("androidVoice",i==0?"":values.get(i-1).getName()).apply();prepareVoice();}).show();
    }
    private void confirmLogout(){new AlertDialog.Builder(this).setMessage("Apagar a autorização e os conteúdos locais deste aparelho? A revogação no servidor pode ser feita no painel.").setNegativeButton("Cancelar",null).setPositiveButton("Apagar",(d,w)->{stopPairing();stopPlayer();generation++;tokens.clear();prefs.edit().putBoolean("authorized",false).remove("androidVoice").apply();for(File f:list(getFilesDir()))if(f.isDirectory()&&f.getName().startsWith("media-"))for(File child:list(f))child.delete();settings=new JSONObject();playlist.clear();mediaSignature="";renderSignature="";showSetup();}).show();}
    @Override public void onBackPressed(){if(pairingMode){showSetup();}else showOptions();}
    @Override public boolean onKeyDown(int key,KeyEvent event){if(key==KeyEvent.KEYCODE_MENU){showOptions();return true;}return super.onKeyDown(key,event);}
    @Override protected void onResume(){super.onResume();resumed=true;immersive();if(refreshVoice){refreshVoice=false;initializeVoice();}if(pairingMode)startPairPoll();if(playerMode){seen=-1;lastSuccess=0;startPoll();if(!playlist.isEmpty())playNext();}}
    @Override protected void onPause(){resumed=false;stopPoll();if(pairTask!=null){pairTask.cancel(true);pairTask=null;}ui.removeCallbacks(advance);if(video!=null)video.pause();if(tts!=null)tts.stop();super.onPause();}
    @Override protected void onDestroy(){destroyed=true;resumed=false;stopPairing();stopPlayer();ui.removeCallbacksAndMessages(null);network.shutdownNow();downloads.shutdownNow();if(tts!=null)tts.shutdown();if(tone!=null){tone.release();tone=null;}super.onDestroy();}
}
