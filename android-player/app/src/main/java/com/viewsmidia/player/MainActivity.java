package com.viewsmidia.player;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
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
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.*;
import org.json.*;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.net.URL;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Native read-only TV player. Login WebView has no JavaScript/native bridge. */
public class MainActivity extends Activity {
    private static final String DEFAULT_SITE="https://rede8-senhas-piloto.grupo-ortocd-0618.chatgpt.site";
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService network=Executors.newSingleThreadScheduledExecutor();
    private final ExecutorService downloads=Executors.newSingleThreadExecutor();
    private final AtomicBoolean syncing=new AtomicBoolean(false);
    private ScheduledFuture<?> pollTask;
    private SharedPreferences prefs;
    private volatile String origin="", desiredMedia="", playingId="";
    private volatile int generation=0;
    private volatile boolean resumed=false, playerMode=false, destroyed=false;
    private File mediaDir;
    private JSONObject settings=new JSONObject();
    private JSONArray events=new JSONArray(),counters=new JSONArray();
    private TextToSpeech tts;
    private boolean voiceReady=false, authNeeded=false, mediaReady=false;
    private long seen=-1,lastSuccess=0,lastMediaAttempt=0;
    private String mediaSignature="",renderSignature="",appliedSettings="",speechStatus="",cacheStatus="";
    private int playlistIndex=0;
    private final ArrayList<JSONObject> playlist=new ArrayList<>();
    private LinearLayout root,body,ticketColumn;
    private FrameLayout mediaFrame;
    private TextView brand,status,code,counter,history,message,clock;
    private VideoView video;
    private WebView loginView;
    private Bitmap bitmap;
    private ToneGenerator tone;
    private final Runnable advance=new Runnable(){@Override public void run(){playNext();}};
    private final Runnable tick=new Runnable(){@Override public void run(){if(destroyed)return;if(playerMode){renderCalls();}ui.postDelayed(this,1000);}};

    @Override public void onCreate(Bundle state){
        super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);immersive();
        prefs=getSharedPreferences("views-tv",MODE_PRIVATE);origin=prefs.getString("origin",DEFAULT_SITE);setMediaDir();
        tts=new TextToSpeech(this,result->{voiceReady=result==TextToSpeech.SUCCESS;if(voiceReady){int available=tts.setLanguage(new Locale("pt","BR"));if(available<0)speechStatus="Instale uma voz em português no Android.";}else speechStatus="Voz do Android indisponível.";});
        try{tone=new ToneGenerator(AudioManager.STREAM_MUSIC,50);}catch(RuntimeException ignored){}
        if(prefs.getBoolean("configured",false))openPlayer();else showSetup();ui.post(tick);
    }
    private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);}
    private void setMediaDir(){try{byte[] hash=MessageDigest.getInstance("SHA-256").digest(origin.getBytes("UTF-8"));StringBuilder b=new StringBuilder();for(int i=0;i<12;i++)b.append(String.format(Locale.ROOT,"%02x",hash[i]));mediaDir=new File(getFilesDir(),"media-"+b);mediaDir.mkdirs();}catch(Exception e){throw new IllegalStateException(e);}}
    private int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private TextView text(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextColor(Color.WHITE);v.setTextSize(size);v.setGravity(Gravity.CENTER);v.setPadding(dp(8),dp(5),dp(8),dp(5));return v;}
    private Button button(String label,Runnable action){Button b=new Button(this);b.setText(label);b.setAllCaps(false);b.setOnClickListener(v->action.run());return b;}
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);l.setGravity(Gravity.CENTER);return l;}
    private void stopPlayer(){playerMode=false;stopPoll();stopMedia();if(tts!=null)tts.stop();}
    private void showSetup(){
        stopPlayer();generation++;seen=-1;lastSuccess=0;authNeeded=false;
        LinearLayout layout=column();layout.setPadding(dp(40),dp(16),dp(40),dp(16));layout.setBackgroundColor(Color.rgb(52,46,78));
        layout.addView(text("Views TV · Piloto Android",26));layout.addView(text("Informe a instalação do cliente. As mídias serão baixadas neste aparelho.",15));
        EditText url=new EditText(this);url.setSingleLine(true);url.setTextColor(Color.WHITE);url.setText(origin);url.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);layout.addView(url,new LinearLayout.LayoutParams(-1,dp(55)));
        layout.addView(button("Entrar e configurar aparelho",()->{try{String selected=PlayerRules.siteOrigin(url.getText().toString());if(!selected.equals(origin)){origin=selected;setMediaDir();settings=new JSONObject();playlist.clear();mediaSignature="";renderSignature="";}prefs.edit().putString("origin",origin).putBoolean("configured",true).apply();openLogin();}catch(IllegalArgumentException e){new AlertDialog.Builder(this).setMessage(e.getMessage()).setPositiveButton("OK",null).show();}}));
        layout.addView(button("Abrir player / usar mídias já baixadas",this::openPlayer));
        layout.addView(text("Primeiro acesso exige login ChatGPT autorizado na instalação.\nNenhuma senha é armazenada pelo aplicativo. Pressione Voltar para abrir as opções.",13));
        setContentView(layout);url.clearFocus();immersive();
    }
    private void openLogin(){
        stopPlayer();generation++;seen=-1;lastSuccess=0;
        LinearLayout layout=column();layout.setBackgroundColor(Color.rgb(52,46,78));LinearLayout actions=new LinearLayout(this);actions.addView(button("Concluir login e abrir TV",()->{CookieManager.getInstance().flush();destroyLogin();openPlayer();}));actions.addView(button("Voltar",()->{destroyLogin();showSetup();}));layout.addView(actions);
        loginView=new WebView(this);loginView.getSettings().setJavaScriptEnabled(true);loginView.getSettings().setDomStorageEnabled(true);loginView.getSettings().setAllowFileAccess(false);loginView.getSettings().setAllowContentAccess(false);loginView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);CookieManager.getInstance().setAcceptCookie(true);
        loginView.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){return !PlayerRules.loginHost(origin,req.getUrl().toString());}
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError error){handler.cancel();Toast.makeText(MainActivity.this,"Não foi possível validar a conexão segura.",Toast.LENGTH_LONG).show();}
        });layout.addView(loginView,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);loginView.loadUrl(origin+"/painel");
    }
    private void destroyLogin(){if(loginView!=null){loginView.stopLoading();loginView.destroy();loginView=null;}}
    private void openPlayer(){
        destroyLogin();stopPlayer();playerMode=true;generation++;seen=-1;lastSuccess=0;events=new JSONArray();counters=new JSONArray();authNeeded=false;renderSignature="";
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
        if(stale){code.setText("—");counter.setText(authNeeded?"Entre novamente nas opções":"Sem conexão para novas chamadas");history.setText("");}
        else {JSONObject event=events.optJSONObject(events.length()-1);code.setText(event==null?"—":event.optString("code","—"));counter.setText(event==null?"Aguarde a primeira chamada":event.optString("counter",""));StringBuilder h=new StringBuilder();int count=Math.max(1,Math.min(8,settings.optInt("historyCount",5)));for(int i=events.length()-1;i>=Math.max(0,events.length()-count);i--){JSONObject e=events.optJSONObject(i);if(e!=null)h.append(e.optString("code")).append("  ·  ").append(e.optString("counter")).append('\n');}history.setText(h.toString().trim());}
        status.setText((stale?(authNeeded?"Login necessário":"Sem atualização · mídias locais continuam"):"Conectado · chamadas em tempo real")+(cacheStatus.isEmpty()?"":"  |  "+cacheStatus)+(speechStatus.isEmpty()?"":"  |  "+speechStatus));
    }
    private void startPoll(){if(!resumed||!playerMode||destroyed||pollTask!=null)return;final int epoch=generation;pollTask=network.scheduleWithFixedDelay(()->poll(epoch),0,2,TimeUnit.SECONDS);}
    private void stopPoll(){if(pollTask!=null){pollTask.cancel(true);pollTask=null;}}
    private HttpsURLConnection connection(String site,String path,String cookies)throws Exception{
        if(!path.equals("/api/queue")&&!path.startsWith("/api/media/"))throw new IOException("Endpoint inválido");
        HttpsURLConnection c=(HttpsURLConnection)new URL(site+path).openConnection();c.setInstanceFollowRedirects(false);c.setUseCaches(false);c.setRequestProperty("Cache-Control","no-store");c.setConnectTimeout(10000);c.setReadTimeout(15000);c.setRequestProperty("Accept",path.equals("/api/queue")?"application/json":"image/*,video/*");if(cookies!=null&&!cookies.isEmpty())c.setRequestProperty("Cookie",cookies);return c;
    }
    private String response(HttpsURLConnection c,int limit)throws Exception{try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>limit)throw new IOException("Resposta grande demais");out.write(buffer,0,n);}return out.toString("UTF-8");}}
    private void poll(int epoch){
        if(!playerMode||!resumed||destroyed||epoch!=generation)return;
        HttpsURLConnection c=null;try{String site=origin;String cookies=CookieManager.getInstance().getCookie(site);c=connection(site,"/api/queue",cookies);int http=c.getResponseCode();if(http==401||http==403||http==302||http==303||!(c.getContentType()!=null&&c.getContentType().contains("application/json"))){ui.post(()->{if(epoch==generation){authNeeded=true;renderCalls();}});return;}if(http!=200)throw new IOException("HTTP "+http);JSONObject snap=new JSONObject(response(c,1024*1024));JSONObject cfg=snap.getJSONObject("settings"),queue=snap.getJSONObject("queue");
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
    private void speak(JSONObject event){
        if(!voiceReady){speechStatus="Voz Android indisponível · verifique as opções";return;}JSONObject voice=settings.optJSONObject("voice"),texts=settings.optJSONObject("texts");if(voice==null||texts==null)return;float volume=(float)Math.max(0,Math.min(1,voice.optDouble("volume",1)));tts.setLanguage(new Locale("pt","BR"));tts.setSpeechRate((float)Math.max(.6,Math.min(1.4,voice.optDouble("rate",.9))));String name=prefs.getString("androidVoice","");Set<Voice> voices=tts.getVoices();if(voices!=null)for(Voice v:voices)if(v.getName().equals(name)){tts.setVoice(v);break;}
        String template=texts.optString(event.optBoolean("recall")?"recallCall":"nextCall","Senha {senha}, dirija-se ao {guiche}.");String phrase=PlayerRules.announcement(template,event.optString("code"),event.optString("counter"),event.optString("serviceName","Atendimento"));Bundle params=new Bundle();params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME,volume);
        if(volume>0&&tone!=null&&!"none".equals(voice.optString("chime"))){tone.startTone(ToneGenerator.TONE_PROP_BEEP,200);if("double".equals(voice.optString("chime")))ui.postDelayed(()->{if(playerMode&&tone!=null)tone.startTone(ToneGenerator.TONE_PROP_BEEP,200);},250);}
        if(tts.speak(phrase,TextToSpeech.QUEUE_ADD,params,"call-"+event.optLong("id"))==TextToSpeech.ERROR)speechStatus="Falha na voz Android";else speechStatus="";
    }
    private void showOptions(){
        new AlertDialog.Builder(this).setTitle("Views TV · Opções").setItems(new String[]{"Continuar reprodução","Entrar / renovar sessão","Escolher voz Android","Testar voz","Configurar URL do cliente","Sair da conta e apagar mídias locais"},(d,index)->{switch(index){case 1:openLogin();break;case 2:chooseVoice();break;case 3:if(voiceReady){tts.setLanguage(new Locale("pt","BR"));String selected=prefs.getString("androidVoice","");if(tts.getVoices()!=null)for(Voice v:tts.getVoices())if(v.getName().equals(selected)){tts.setVoice(v);break;}tts.speak("Senha N zero zero um. Dirija-se ao guichê um.",TextToSpeech.QUEUE_FLUSH,null,"test");}else Toast.makeText(this,"Instale ou ative o mecanismo de voz do Android.",Toast.LENGTH_LONG).show();break;case 4:showSetup();break;case 5:confirmLogout();break;default:immersive();}}).show();
    }
    private void chooseVoice(){
        if(!voiceReady||tts.getVoices()==null){Toast.makeText(this,"Não há mecanismo de voz disponível.",Toast.LENGTH_LONG).show();return;}ArrayList<Voice> values=new ArrayList<>();for(Voice v:tts.getVoices())if(v.getLocale().getLanguage().equals("pt"))values.add(v);Collections.sort(values,(a,b)->a.getName().compareTo(b.getName()));String[] names=new String[values.size()+1];names[0]="Automática — português do Android";for(int i=0;i<values.size();i++)names[i+1]=values.get(i).getName()+(values.get(i).isNetworkConnectionRequired()?" · requer internet":" · local");new AlertDialog.Builder(this).setTitle("Voz deste aparelho").setItems(names,(d,i)->{prefs.edit().putString("androidVoice",i==0?"":values.get(i-1).getName()).apply();if(i==0)tts.setLanguage(new Locale("pt","BR"));else tts.setVoice(values.get(i-1));}).show();
    }
    private void confirmLogout(){new AlertDialog.Builder(this).setMessage("Sair da conta e apagar os conteúdos baixados neste aparelho?").setNegativeButton("Cancelar",null).setPositiveButton("Sair",(d,w)->{stopPlayer();generation++;CookieManager.getInstance().removeAllCookies(null);CookieManager.getInstance().flush();android.webkit.WebStorage.getInstance().deleteAllData();prefs.edit().putBoolean("configured",false).remove("androidVoice").apply();for(File f:getFilesDir().listFiles()==null?new File[0]:getFilesDir().listFiles())if(f.isDirectory()&&f.getName().startsWith("media-"))for(File child:list(f))child.delete();settings=new JSONObject();playlist.clear();mediaSignature="";renderSignature="";showSetup();}).show();}
    @Override public void onBackPressed(){if(loginView!=null){if(loginView.canGoBack())loginView.goBack();else{destroyLogin();showSetup();}}else showOptions();}
    @Override public boolean onKeyDown(int key,KeyEvent event){if(key==KeyEvent.KEYCODE_MENU){showOptions();return true;}return super.onKeyDown(key,event);}
    @Override protected void onResume(){super.onResume();resumed=true;immersive();if(playerMode){seen=-1;lastSuccess=0;startPoll();if(!playlist.isEmpty())playNext();}}
    @Override protected void onPause(){resumed=false;stopPoll();ui.removeCallbacks(advance);if(video!=null)video.pause();if(tts!=null)tts.stop();super.onPause();}
    @Override protected void onDestroy(){destroyed=true;resumed=false;stopPlayer();destroyLogin();ui.removeCallbacksAndMessages(null);network.shutdownNow();downloads.shutdownNow();if(tts!=null)tts.shutdown();if(tone!=null){tone.release();tone=null;}super.onDestroy();}
}
