-- save_job: transactional insert of a processed job (sections, line items,
-- optional items). Same job_number => new revision; earlier revisions are
-- marked superseded. Returns the new job id.

create or replace function public.save_job(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_job_id   uuid;
  v_rev      integer;
  v_sec      jsonb;
  v_sec_id   uuid;
  v_line     jsonb;
  v_opt      jsonb;
  v_i        integer := 0;
begin
  select coalesce(max(revision), 0) + 1 into v_rev
    from public.jobs where job_number = p->>'job_number';

  update public.jobs set status = 'superseded'
    where job_number = p->>'job_number' and status = 'active';

  insert into public.jobs (
    job_number, revision, title, client_org, site_suburb, issued_on, status,
    structure, room_type, install_type, subtotal_ex_gst, params, scope_text,
    assumptions, exclusions, has_labour_detail, is_holdout
  ) values (
    p->>'job_number', v_rev, p->>'title', p->>'client_org', p->>'site_suburb',
    nullif(p->>'issued_on', '')::date, 'active',
    p->>'structure', p->>'room_type', p->>'install_type',
    nullif(p->>'subtotal_ex_gst', '')::numeric, coalesce(p->'params', '{}'::jsonb), p->>'scope_text',
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'assumptions', '[]'::jsonb)) x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'exclusions', '[]'::jsonb)) x), '{}'),
    coalesce((p->>'has_labour_detail')::boolean, false),
    coalesce((p->>'is_holdout')::boolean, false)
  ) returning id into v_job_id;

  for v_sec in select * from jsonb_array_elements(coalesce(p->'sections', '[]'::jsonb)) loop
    insert into public.sections (id, job_id, name, kind, sort, total)
    values ((v_sec->>'id')::uuid, v_job_id, v_sec->>'name', coalesce(v_sec->>'kind', 'system'),
            coalesce((v_sec->>'sort')::integer, 0), nullif(v_sec->>'total', '')::numeric)
    returning id into v_sec_id;
  end loop;

  -- Two passes so parent_id references resolve regardless of order.
  for v_line in select * from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) loop
    insert into public.line_items (
      id, section_id, parent_id, grp, code, part_number, description, qty, unit_price, total,
      is_existing, activity, hours, rate, sort
    ) values (
      (v_line->>'id')::uuid, (v_line->>'section_id')::uuid, null,
      v_line->>'grp', v_line->>'code', v_line->>'part_number', v_line->>'description',
      coalesce(nullif(v_line->>'qty', '')::numeric, 1), nullif(v_line->>'unit_price', '')::numeric,
      nullif(v_line->>'total', '')::numeric, coalesce((v_line->>'is_existing')::boolean, false),
      v_line->>'activity', nullif(v_line->>'hours', '')::numeric, nullif(v_line->>'rate', '')::numeric,
      coalesce((v_line->>'sort')::integer, 0)
    );
  end loop;

  for v_line in select * from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb)) loop
    if nullif(v_line->>'parent_id', '') is not null then
      update public.line_items set parent_id = (v_line->>'parent_id')::uuid
        where id = (v_line->>'id')::uuid;
    end if;
  end loop;

  for v_opt in select * from jsonb_array_elements(coalesce(p->'optional_items', '[]'::jsonb)) loop
    insert into public.optional_items (job_id, description, part_number, qty, unit_price, total, sort)
    values (v_job_id, v_opt->>'description', v_opt->>'part_number',
            coalesce(nullif(v_opt->>'qty', '')::numeric, 1), nullif(v_opt->>'unit_price', '')::numeric,
            nullif(v_opt->>'total', '')::numeric, v_i);
    v_i := v_i + 1;
  end loop;

  if nullif(p->>'document_id', '') is not null then
    update public.documents set job_id = v_job_id, status = 'confirmed'
      where id = (p->>'document_id')::uuid;
  end if;

  return v_job_id;
end;
$$;

revoke all on function public.save_job(jsonb) from public, anon, authenticated;
