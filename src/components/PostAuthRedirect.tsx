import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasPendingPostAuthRedirect, takePostAuthRedirect, tokensFromUrl } from "@/lib/postAuthRedirect";

/**
 * After Google sign-in returns to the site root, finish the session (if the tokens in the
 * address were not picked up automatically) and open the page the user started from.
 */
const PostAuthRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      const path = takePostAuthRedirect();
      if (!path) return;
      done = true;
      if (path !== window.location.pathname) navigate(path, { replace: true });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && hasPendingPostAuthRedirect()) setTimeout(go, 0);
    });

    const tokens = tokensFromUrl(window.location.href);
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session && tokens) {
        const { data } = await supabase.auth.setSession(tokens);
        if (data.session) {
          window.history.replaceState(window.history.state, "", window.location.pathname);
        }
        return; // onAuthStateChange handles the navigation
      }
      if (session && hasPendingPostAuthRedirect()) go();
    });

    return () => {
      done = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return null;
};

export default PostAuthRedirect;
