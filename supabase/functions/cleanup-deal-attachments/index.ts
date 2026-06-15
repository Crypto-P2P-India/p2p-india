import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealId } = await req.json();
    if (!dealId) {
      return new Response(JSON.stringify({ error: "Missing dealId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1) Delete all attachment files in the deal folder
    const folderPath = `deal-${dealId}/`;
    const { data: files } = await supabase.storage
      .from("deal-attachments")
      .list(folderPath);

    let deletedFiles = 0;
    if (files && files.length > 0) {
      const filePaths = files.map((f: any) => `${folderPath}${f.name}`);
      const { error: deleteError } = await supabase.storage
        .from("deal-attachments")
        .remove(filePaths);
      if (deleteError) console.error("Storage delete error:", deleteError);
      else deletedFiles = filePaths.length;
    }

    // 2) Delete ALL chat messages for this completed deal (text + attachment rows)
    //    to free up database storage. Service role bypasses RLS.
    const { error: msgError, count } = await supabase
      .from("deal_messages")
      .delete({ count: "exact" })
      .eq("deal_id", dealId);

    if (msgError) console.error("Message delete error:", msgError);

    return new Response(
      JSON.stringify({ success: true, deletedFiles, deletedMessages: count ?? 0 }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
