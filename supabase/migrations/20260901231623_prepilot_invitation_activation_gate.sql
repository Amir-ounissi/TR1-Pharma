drop trigger if exists activate_memberships_after_onboarding on public.user_profiles;

revoke all on function public.accept_my_invited_memberships() from public, anon, authenticated, service_role;
