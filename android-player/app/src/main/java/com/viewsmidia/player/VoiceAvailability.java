package com.viewsmidia.player;
/** Distinguishes initialization, missing service and missing Portuguese data. */
public final class VoiceAvailability {
 private VoiceAvailability(){}
 public static boolean ready(boolean initialized,int language){return initialized&&language>=0;}
 public static String message(boolean loading,boolean initialized,int engines,int language){
  if(loading)return "Preparando mecanismo de voz…";
  if(!initialized)return engines==0?"Nenhum mecanismo de voz instalado ou habilitado no Android.":"Mecanismo de voz encontrado, mas não foi possível iniciá-lo. Tente reconectar nas opções.";
  if(language==-1)return "Faltam os dados de voz em português. Verifique ou instale os dados nas opções.";
  if(language==-2)return "O mecanismo selecionado não oferece português. Escolha outro mecanismo nas opções.";
  if(language<0)return "Não foi possível preparar a voz em português. Verifique o mecanismo nas opções.";
  return "";
 }
}
