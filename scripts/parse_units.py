import json
import os
import glob
import re
import shutil

# Configuration paths
GAME_MEDIA_DIR = r"F:\SteamLibrary\steamapps\common\Planetary Annihilation Titans\media"
UNITS_DIR = os.path.join(GAME_MEDIA_DIR, "pa", "units")
UNIT_LIST_PATH = os.path.join(UNITS_DIR, "unit_list.json")

# Vue app paths
OUTPUT_DIR = r"c:\Папки\коды\PA-Dashboard"
VUE_DATA_DIR = os.path.join(OUTPUT_DIR, "src", "data")
VUE_PUBLIC_UNITS_DIR = os.path.join(OUTPUT_DIR, "public", "units")

os.makedirs(VUE_DATA_DIR, exist_ok=True)
os.makedirs(VUE_PUBLIC_UNITS_DIR, exist_ok=True)

# ── Spec resolver ────────────────────────────────────────────────
def resolve_spec(spec_path):
    if not spec_path:
        return {}
    rel_path = spec_path.lstrip('/')
    if rel_path.startswith('pa/'):
        ex1_path = rel_path.replace('pa/', 'pa_ex1/', 1)
        abs_path = os.path.join(GAME_MEDIA_DIR, ex1_path)
        if not os.path.exists(abs_path):
            abs_path = os.path.join(GAME_MEDIA_DIR, rel_path)
    else:
        abs_path = os.path.join(GAME_MEDIA_DIR, rel_path)
    if not os.path.exists(abs_path):
        return {}
    try:
        with open(abs_path, 'r', encoding='utf-8') as f:
            spec_data = json.load(f)
    except Exception as e:
        print(f"Error loading {abs_path}: {e}")
        return {}
    merged = {}
    if 'base_spec' in spec_data:
        merged = resolve_spec(spec_data['base_spec'])
    for k, v in spec_data.items():
        if isinstance(v, dict) and k in merged and isinstance(merged[k], dict):
            merged_dict = merged[k].copy()
            merged_dict.update(v)
            merged[k] = merged_dict
        elif isinstance(v, list) and k in merged and isinstance(merged[k], list):
            merged[k] = v
        else:
            merged[k] = v
    return merged

# ── Unit-type expression evaluator ──────────────────────────────
def eval_expr(expr_str, unit_types_set):
    if not expr_str:
        return False
    types = {t.replace("UNITTYPE_", "").lower(): True for t in unit_types_set}
    tokens = re.findall(r'[a-zA-Z0-9_]+|[&|\-()]', expr_str)
    py_tokens = []
    for tok in tokens:
        if tok == '&':
            py_tokens.append('and')
        elif tok == '|':
            py_tokens.append('or')
        elif tok == '-':
            py_tokens.append('and not')
        elif tok in ('(', ')'):
            py_tokens.append(tok)
        else:
            type_lower = tok.lower()
            if type_lower.startswith("custom") or type_lower.startswith("unittype_custom"):
                py_tokens.append("True")
            else:
                py_tokens.append(str(types.get(type_lower, False)))
    try:
        return eval(" ".join(py_tokens))
    except Exception:
        return False

def clean_text(text):
    if not text:
        return ""
    text_str = str(text)
    text_str = re.sub(r'^!LOC:?', '', text_str)
    text_str = re.sub(r'^!', '', text_str)
    return text_str.strip()

# ── Target layer → human-readable label ─────────────────────────
LAYER_LABELS = {
    "WL_LandHorizontal":  "Land",
    "WL_WaterSurface":    "Sea",
    "WL_Seafloor":        "Seafloor",
    "WL_Air":             "Air",
    "WL_Orbital":         "Orbital",
    "Orbital":            "Orbital",
    "WL_AnySurface":      "Land+Sea",
}

def layers_to_labels(layers):
    seen = set()
    result = []
    for l in layers:
        lbl = LAYER_LABELS.get(l, l)
        if lbl not in seen:
            seen.add(lbl)
            result.append(lbl)
    return result

# ── Tier detection ───────────────────────────────────────────────
def detect_tier(unit_types):
    types_lower = [t.lower() for t in unit_types]
    if "unittype_advanced" in types_lower:
        return "T2"
    if "unittype_titan" in types_lower:
        return "Titan"
    return "T1"

# ── Main ─────────────────────────────────────────────────────────
def main():
    print(f"Loading unit list from {UNIT_LIST_PATH}...")
    with open(UNIT_LIST_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    all_units_raw = data['units']

    ex_list_path = os.path.join(GAME_MEDIA_DIR, "pa_ex1", "units", "unit_list.json")
    if os.path.exists(ex_list_path):
        print(f"Loading expansion unit list from {ex_list_path}...")
        try:
            with open(ex_list_path, 'r', encoding='utf-8') as f:
                ex_data = json.load(f)
            all_units_raw = list(set(all_units_raw + ex_data['units']))
        except Exception as e:
            print(f"Error loading expansion unit list: {e}")

    print(f"Found {len(all_units_raw)} total specs in combined lists.")
    parsed_units = []

    for spec_path in all_units_raw:
        spec = resolve_spec(spec_path)
        if not spec:
            continue

        rel_path = spec_path.lstrip('/')
        if rel_path.startswith('pa/'):
            ex1_path = rel_path.replace('pa/', 'pa_ex1/', 1)
            abs_json_path = os.path.join(GAME_MEDIA_DIR, ex1_path)
            if not os.path.exists(abs_json_path):
                abs_json_path = os.path.join(GAME_MEDIA_DIR, rel_path)
        else:
            abs_json_path = os.path.join(GAME_MEDIA_DIR, rel_path)

        unit_folder = os.path.dirname(abs_json_path)

        buildbar_icons = glob.glob(os.path.join(unit_folder, "*_icon_buildbar.png"))
        if not buildbar_icons and "pa_ex1" in unit_folder:
            base_unit_folder = unit_folder.replace("pa_ex1", "pa", 1)
            buildbar_icons = glob.glob(os.path.join(base_unit_folder, "*_icon_buildbar.png"))
        if not buildbar_icons:
            continue

        icon_src = buildbar_icons[0]
        safe_img_name = spec_path.strip('/').replace('/', '_').replace('.json', '.png')
        icon_dest = os.path.join(VUE_PUBLIC_UNITS_DIR, safe_img_name)

        try:
            from PIL import Image
            img = Image.open(icon_src).convert("RGBA")
            datas = img.getdata()
            newData = []
            for item in datas:
                if item[0] < 12 and item[1] < 12 and item[2] < 12:
                    newData.append((0, 0, 0, 0))
                else:
                    newData.append(item)
            img.putdata(newData)
            img.save(icon_dest, "PNG")
        except Exception as e:
            print(f"Could not transparentize icon {icon_src}: {e}")
            shutil.copy2(icon_src, icon_dest)

        # ── Basic fields ────────────────────────────────────────
        name = clean_text(spec.get('unit_name') or spec.get('display_name'))
        if not name:
            name = os.path.basename(spec_path).replace('.json', '').replace('_', ' ').title()

        desc = clean_text(spec.get('description'))
        health = spec.get('max_health', 0)
        cost = spec.get('build_metal_cost', 0)
        unit_types = spec.get('unit_types', [])
        tier = detect_tier(unit_types)

        # ── Category ────────────────────────────────────────────
        category = "land"
        if "commanders" in spec_path:
            category = "commander"
        elif "air" in spec_path:
            category = "air"
        elif "orbital" in spec_path:
            category = "orbital"
        elif "sea" in spec_path:
            category = "sea"
        elif "UNITTYPE_Air" in unit_types:
            category = "air"
        elif "UNITTYPE_Naval" in unit_types:
            category = "sea"
        elif "UNITTYPE_Orbital" in unit_types:
            category = "orbital"
        elif "UNITTYPE_Commander" in unit_types:
            category = "commander"

        # ── Navigation / Physics ────────────────────────────────
        nav = spec.get('navigation', {})
        move_speed   = nav.get('move_speed', 0)
        turn_speed   = nav.get('turn_speed', 0)
        acceleration = nav.get('acceleration', 0)

        # ── Recon ───────────────────────────────────────────────
        recon = spec.get('recon', {})
        vision_radius = 0
        radar_radius  = 0
        try:
            for item in recon.get('observer', {}).get('items', []):
                ch = item.get('channel', '')
                r  = item.get('radius', 0)
                if ch == 'sight' and r > vision_radius:
                    vision_radius = r
                elif ch in ('radar', 'advanced_radar') and r > radar_radius:
                    radar_radius = r
        except Exception:
            pass

        # ── Weapons ─────────────────────────────────────────────
        weapons = []
        weapon_index = 0
        for tool_entry in spec.get('tools', []):
            tool_spec_path = tool_entry.get('spec_id')
            if not tool_spec_path:
                continue
            tool_spec = resolve_spec(tool_spec_path)
            if not tool_spec:
                continue

            tool_type = tool_spec.get('tool_type', 'TOOL_Weapon')
            if tool_type != 'TOOL_Weapon' and 'ammo_id' not in tool_spec:
                continue

            ammo_val = tool_spec.get('ammo_id')
            if not ammo_val:
                continue

            ammo_spec_path = None
            if isinstance(ammo_val, list):
                if len(ammo_val) > 0 and isinstance(ammo_val[0], dict):
                    ammo_spec_path = ammo_val[0].get('id')
            elif isinstance(ammo_val, str):
                ammo_spec_path = ammo_val

            if not ammo_spec_path:
                continue

            ammo_spec = resolve_spec(ammo_spec_path)

            # Core weapon stats
            damage        = ammo_spec.get('damage', 0)
            splash_damage = ammo_spec.get('splash_damage', 0)
            splash_radius = ammo_spec.get('splash_radius', 0)
            rate_of_fire  = tool_spec.get('rate_of_fire', 1.0)
            max_range     = tool_spec.get('max_range', 0)
            min_range     = tool_spec.get('min_range', 0)
            muzzle_vel    = ammo_spec.get('initial_velocity', ammo_spec.get('muzzle_velocity', 0))
            max_vel       = ammo_spec.get('max_velocity', 0)
            turn_rate_ammo= ammo_spec.get('turn_rate', 0)
            flight_type   = ammo_spec.get('flight_type', '')

            dps = round(rate_of_fire * damage, 2)

            # Weapon display name
            weapon_display_name = clean_text(ammo_spec.get('display_name') or tool_spec.get('display_name', ''))
            if not weapon_display_name:
                weapon_index += 1
                weapon_display_name = f"Weapon #{weapon_index}"

            # Target layers
            target_layers = tool_spec.get('target_layers', [])
            if not target_layers:
                target_layers = ['WL_LandHorizontal', 'WL_WaterSurface']
            target_labels = layers_to_labels(target_layers)

            # Target priorities
            target_priorities = tool_spec.get('target_priorities', [])

            # Armor damage map (reduction vs specific armor types)
            armor_damage_map = ammo_spec.get('armor_damage_map', {})

            # Auto-attack / manual fire
            auto_attack  = tool_spec.get('auto_attack', True)
            manual_fire  = tool_spec.get('manual_fire', False)

            # Anti-entity targets
            anti_entity_targets = tool_spec.get('anti_entity_targets', [])

            if dps > 0 or max_range > 0:
                weapons.append({
                    'name':             weapon_display_name,
                    'dps':              dps,
                    'damage':           damage,
                    'splash_damage':    splash_damage,
                    'splash_radius':    splash_radius,
                    'rate_of_fire':     rate_of_fire,
                    'range':            max_range,
                    'min_range':        min_range,
                    'muzzle_velocity':  muzzle_vel,
                    'max_velocity':     max_vel,
                    'turn_rate':        turn_rate_ammo,
                    'flight_type':      flight_type,
                    'target_layers':    target_layers,
                    'target_labels':    target_labels,
                    'target_priorities':target_priorities,
                    'armor_damage_map': armor_damage_map,
                    'auto_attack':      auto_attack,
                    'manual_fire':      manual_fire,
                    'anti_entity_targets': anti_entity_targets,
                    'ammo_spec_path':   ammo_spec_path,
                    'tool_spec_path':   tool_spec_path,
                })

        total_dps = round(sum(w['dps'] for w in weapons), 2)
        max_range  = max([w['range'] for w in weapons]) if weapons else 0

        # Collect all unique target labels across all weapons
        all_target_labels = []
        seen_labels = set()
        for w in weapons:
            for lbl in w['target_labels']:
                if lbl not in seen_labels:
                    seen_labels.add(lbl)
                    all_target_labels.append(lbl)

        # ── Factory / Builder ───────────────────────────────────
        buildable_types = spec.get('buildable_types')
        if not buildable_types:
            for tool_entry in spec.get('tools', []):
                t_spec_path = tool_entry.get('spec_id')
                if t_spec_path:
                    t_spec = resolve_spec(t_spec_path)
                    if t_spec and 'buildable_types' in t_spec:
                        buildable_types = t_spec['buildable_types']
                        break

        is_factory = "UNITTYPE_Factory" in unit_types or buildable_types is not None

        # ── command_caps & Builder detection ──────────────────────
        command_caps = spec.get('command_caps', [])
        is_builder = 'ORDER_Repair' in command_caps

        # ── Build metal rate (repair HP/s proxy) ───────────────────
        # Builders have a BuildArm tool; construction_demand.metal = metal/s
        build_metal_rate = 0
        if is_builder or 'ORDER_Build' in command_caps:
            for tool_entry in spec.get('tools', []):
                t_spec_path = tool_entry.get('spec_id')
                if not t_spec_path:
                    continue
                t_spec = resolve_spec(t_spec_path)
                if not t_spec:
                    continue
                tt = t_spec.get('tool_type', '')
                if tt == 'TOOL_BuildArm':
                    cd = t_spec.get('construction_demand', {})
                    build_metal_rate = cd.get('metal', 0)
                    break
        # ── Own movement layers ────────────────────────────────────
        layers = []
        if "UNITTYPE_Air" in unit_types:
            layers.append("WL_Air")
        elif "UNITTYPE_Orbital" in unit_types:
            layers.append("WL_Orbital")
        elif "UNITTYPE_Naval" in unit_types:
            layers.append("WL_WaterSurface")
            if "UNITTYPE_Sub" in unit_types:
                layers.append("WL_Seafloor")
        else:
            layers.append("WL_LandHorizontal")

        parsed_units.append({
            'id':               spec_path,
            'name':             name,
            'description':      desc,
            'health':           health,
            'cost':             cost,
            'tier':             tier,
            'category':         category,
            'unit_types':       unit_types,
            'is_factory':       is_factory,
            'is_builder':       is_builder,
            'build_metal_rate': build_metal_rate,
            'buildable_types':  buildable_types,
            'weapons':          weapons,
            'dps':              total_dps,
            'range':            max_range,
            'target_labels':    all_target_labels,
            'move_speed':       move_speed,
            'turn_speed':       turn_speed,
            'acceleration':     acceleration,
            'vision_radius':    vision_radius,
            'radar_radius':     radar_radius,
            'icon':             f"/units/{safe_img_name}",
            'buildable_unit_ids': [],
            'layers':           layers,
        })

    print(f"Initially parsed {len(parsed_units)} active units with icons.")

    # ── Resolve factory relations ────────────────────────────────
    factory_count = 0
    for unit in parsed_units:
        if unit['is_factory'] and unit['buildable_types']:
            buildable_expr = unit['buildable_types']
            build_ids = []
            for target_unit in parsed_units:
                if eval_expr(buildable_expr, target_unit['unit_types']):
                    build_ids.append(target_unit['id'])
            unit['buildable_unit_ids'] = build_ids
            if len(build_ids) > 0:
                factory_count += 1

    print(f"Resolved {factory_count} factories build paths.")

    output_json_path = os.path.join(VUE_DATA_DIR, "units.json")
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(parsed_units, f, indent=2, ensure_ascii=False)

    print(f"Successfully wrote unit data to {output_json_path}")
    print(f"Done extracting images to {VUE_PUBLIC_UNITS_DIR}")

if __name__ == "__main__":
    main()
