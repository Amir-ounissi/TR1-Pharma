-- Optional seed for a fresh V2 environment. Does NOT contain legacy products or confidential prices.
insert into public.brands(name,slug,active)
values ('Beauty of Joseon','beauty-of-joseon',false),
       ('Biodance','biodance',false),
       ('Dr. Althea','dr-althea',false),
       ('VK SWISS','vk-swiss',false)
on conflict(slug) do nothing;
