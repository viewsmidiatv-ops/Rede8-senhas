package com.viewsmidia.player;
import java.net.URI;
import java.util.regex.Pattern;
/** Pure rules shared by Activity and the JVM checks. */
public final class PlayerRules {
    private PlayerRules() {}
    private static final Pattern MEDIA = Pattern.compile("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\.(png|jpg|webp|mp4|webm)");
    public static final long MAX_FILE = 20L * 1024 * 1024;
    public static final long MAX_CACHE = 640L * 1024 * 1024;
    public static final long STALE_MS = 15000L;
    public static String siteOrigin(String input) {
        try {
            URI u = new URI(input.trim());
            String h = u.getHost();
            if (!"https".equals(u.getScheme()) || h == null || !h.endsWith(".chatgpt.site") || u.getUserInfo() != null || (u.getPort() != -1 && u.getPort() != 443) || u.getRawQuery() != null || u.getRawFragment() != null || !(u.getPath().isEmpty() || u.getPath().equals("/"))) throw new IllegalArgumentException();
            return "https://" + h.toLowerCase(java.util.Locale.ROOT);
        } catch (Exception e) { throw new IllegalArgumentException("Informe a URL HTTPS inicial da instalação em chatgpt.site."); }
    }
    public static boolean validMedia(String id) { return id != null && MEDIA.matcher(id).matches(); }
    public static int seconds(int value) { return Math.max(5, Math.min(300, value)); }
    public static boolean stale(long lastSuccess, long now) { return lastSuccess == 0 || now - lastSuccess >= STALE_MS; }
    public static String announcement(String template, String code, String counter, String service) {
        return template.replace("{senha}",code.replace('-', ' ')).replace("{guiche}",counter).replace("{servico}",service);
    }
    public static String deviceEndpoint(String input) {
        try { URI u=new URI(input.trim());String h=u.getHost();if(!"https".equals(u.getScheme())||h==null||!h.endsWith(".supabase.co")||u.getUserInfo()!=null||(u.getPort()!=-1&&u.getPort()!=443)||u.getQuery()!=null||u.getFragment()!=null||!u.getPath().equals("/functions/v1/tv-device"))throw new IllegalArgumentException();return "https://"+h.toLowerCase(java.util.Locale.ROOT)+"/functions/v1/tv-device"; }
        catch(Exception e){throw new IllegalArgumentException("Use a URL de conexão Supabase exibida na aba Aparelhos.");}
    }
}
