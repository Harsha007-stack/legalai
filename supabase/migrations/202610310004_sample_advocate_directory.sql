create table if not exists public.sample_advocate_profiles (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  email text not null unique check (email like '%@example.com'),
  display_name text not null,
  bio text not null,
  practice_areas text[] not null,
  jurisdictions text[] not null,
  city text not null,
  state text not null,
  years_experience smallint not null check (years_experience between 0 and 60),
  languages text[] not null,
  remote_available boolean not null,
  consultation_fee_min integer not null check (consultation_fee_min >= 0),
  consultation_fee_max integer not null check (consultation_fee_max >= consultation_fee_min),
  created_at timestamptz not null default now()
);

alter table public.sample_advocate_profiles enable row level security;
revoke all on public.sample_advocate_profiles from anon, authenticated;
grant select on public.sample_advocate_profiles to authenticated;

drop policy if exists sample_advocate_profiles_select_authenticated on public.sample_advocate_profiles;
create policy sample_advocate_profiles_select_authenticated on public.sample_advocate_profiles
for select to authenticated using (true);

insert into public.sample_advocate_profiles (
  id, email, display_name, bio, practice_areas, jurisdictions, city, state,
  years_experience, languages, remote_available, consultation_fee_min, consultation_fee_max
) values
  ('ananya-rao', 'ananya.rao@example.com', 'Ananya Rao', 'Works with individuals on workplace concerns, employment documentation, and practical dispute-resolution options. This fictional profile is included for product demonstration only.', array['Employment', 'Labour'], array['Karnataka', 'Tamil Nadu'], 'Bengaluru', 'Karnataka', 9, array['English', 'Hindi', 'Kannada'], true, 1200, 2000),
  ('kabir-mehta', 'kabir.mehta@example.com', 'Kabir Mehta', 'Focuses on family and civil matters, with an emphasis on helping clients understand available processes and prepare for an initial consultation.', array['Family', 'Civil'], array['Maharashtra'], 'Mumbai', 'Maharashtra', 12, array['English', 'Hindi', 'Marathi'], true, 1500, 2500),
  ('meera-iyer', 'meera.iyer@example.com', 'Meera Iyer', 'Supports people navigating consumer concerns and civil disputes. Consultation details and fees are indicative and would need to be agreed directly.', array['Consumer', 'Civil'], array['Tamil Nadu'], 'Chennai', 'Tamil Nadu', 7, array['English', 'Tamil'], false, 900, 1600),
  ('rohan-deshmukh', 'rohan.deshmukh@example.com', 'Rohan Deshmukh', 'Works on property, tenancy, and civil disputes, helping people understand their options before an initial consultation. This is a fictional profile for demonstration only.', array['Civil', 'Property'], array['Maharashtra'], 'Pune', 'Maharashtra', 11, array['English', 'Hindi', 'Marathi'], true, 1300, 2200),
  ('priya-nair', 'priya.nair@example.com', 'Priya Nair', 'Advises individuals on workplace issues, unpaid wages, and employment documentation. Sample profile only; not a verified listing.', array['Employment', 'Labour'], array['Kerala'], 'Kochi', 'Kerala', 8, array['English', 'Hindi', 'Malayalam'], true, 1000, 1800),
  ('arjun-singh', 'arjun.singh@example.com', 'Arjun Singh', 'Handles civil and consumer disputes with a focus on clear, practical next steps. Fictional demo profile; not a real advocate.', array['Civil', 'Consumer', 'Property'], array['Delhi'], 'New Delhi', 'Delhi', 14, array['English', 'Hindi', 'Punjabi'], false, 1800, 3000),
  ('farah-khan', 'farah.khan@example.com', 'Farah Khan', 'Helps with property registration, tenancy, and civil paperwork. Sample profile for demonstration only.', array['Civil', 'Property'], array['Maharashtra'], 'Nagpur', 'Maharashtra', 10, array['English', 'Hindi', 'Marathi', 'Urdu'], true, 1100, 1900),
  ('siddharth-joshi', 'siddharth.joshi@example.com', 'Siddharth Joshi', 'Works on unpaid wages, employment contracts, and workplace disputes. Fictional demo profile.', array['Employment', 'Labour'], array['Maharashtra'], 'Mumbai', 'Maharashtra', 13, array['English', 'Hindi', 'Marathi'], true, 1600, 2600),
  ('nandini-rao', 'nandini.rao@example.com', 'Nandini Rao', 'Supports family and civil matters with clear, practical guidance. Sample profile only.', array['Family', 'Civil'], array['Karnataka'], 'Bengaluru', 'Karnataka', 9, array['English', 'Hindi', 'Kannada'], true, 1200, 2000),
  ('karthik-subramanian', 'karthik.subramanian@example.com', 'Karthik Subramanian', 'Handles employment and civil disputes for individuals. Fictional demo profile.', array['Employment', 'Civil'], array['Tamil Nadu'], 'Coimbatore', 'Tamil Nadu', 10, array['English', 'Tamil'], false, 1000, 1800),
  ('anand-menon', 'anand.menon@example.com', 'Anand Menon', 'Focuses on property registration and civil disputes. Sample profile for demonstration only.', array['Property', 'Civil'], array['Kerala'], 'Kochi', 'Kerala', 12, array['English', 'Malayalam'], true, 1400, 2200),
  ('ishita-verma', 'ishita.verma@example.com', 'Ishita Verma', 'Works on family and consumer matters with a practical, step-by-step approach. Fictional demo profile.', array['Family', 'Consumer'], array['Delhi'], 'New Delhi', 'Delhi', 8, array['English', 'Hindi'], true, 1200, 2100),
  ('vivek-patel', 'vivek.patel@example.com', 'Vivek Patel', 'Handles property, civil, and consumer disputes. Sample profile only.', array['Civil', 'Property', 'Consumer'], array['Gujarat'], 'Ahmedabad', 'Gujarat', 12, array['English', 'Hindi', 'Gujarati'], true, 1300, 2300),
  ('sneha-reddy', 'sneha.reddy@example.com', 'Sneha Reddy', 'Advises employees on unpaid wages and workplace concerns. Fictional demo profile.', array['Employment', 'Labour'], array['Telangana'], 'Hyderabad', 'Telangana', 9, array['English', 'Hindi', 'Telugu'], true, 1100, 1900),
  ('aritra-banerjee', 'aritra.banerjee@example.com', 'Aritra Banerjee', 'Works on property and civil disputes. Sample profile for demonstration only.', array['Civil', 'Property'], array['West Bengal'], 'Kolkata', 'West Bengal', 13, array['English', 'Bengali', 'Hindi'], true, 1400, 2400),
  ('neha-kapoor', 'neha.kapoor@example.com', 'Neha Kapoor', 'Helps with property registration and civil matters. Fictional demo profile.', array['Civil', 'Property'], array['Uttar Pradesh'], 'Lucknow', 'Uttar Pradesh', 10, array['English', 'Hindi'], false, 1000, 1800),
  ('kavita-rathore', 'kavita.rathore@example.com', 'Kavita Rathore', 'Supports family and civil matters. Sample profile only.', array['Family', 'Civil'], array['Rajasthan'], 'Jaipur', 'Rajasthan', 11, array['English', 'Hindi'], true, 1200, 2000),
  ('simran-kaur', 'simran.kaur@example.com', 'Simran Kaur', 'Works on family and civil disputes. Fictional demo profile.', array['Family', 'Civil'], array['Punjab'], 'Ludhiana', 'Punjab', 12, array['English', 'Hindi', 'Punjabi'], true, 1300, 2100),
  ('rakesh-verma', 'rakesh.verma@example.com', 'Rakesh Verma', 'Handles property and civil disputes. Sample profile for demonstration only.', array['Civil', 'Property'], array['Madhya Pradesh'], 'Bhopal', 'Madhya Pradesh', 15, array['English', 'Hindi'], false, 1200, 2000),
  ('anjali-prasad', 'anjali.prasad@example.com', 'Anjali Prasad', 'Supports family and civil matters. Fictional demo profile.', array['Family', 'Civil'], array['Bihar'], 'Patna', 'Bihar', 9, array['English', 'Hindi'], true, 900, 1600)
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  bio = excluded.bio,
  practice_areas = excluded.practice_areas,
  jurisdictions = excluded.jurisdictions,
  city = excluded.city,
  state = excluded.state,
  years_experience = excluded.years_experience,
  languages = excluded.languages,
  remote_available = excluded.remote_available,
  consultation_fee_min = excluded.consultation_fee_min,
  consultation_fee_max = excluded.consultation_fee_max;
