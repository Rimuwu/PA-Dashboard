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

# Create output folders
os.makedirs(VUE_DATA_DIR, exist_ok=True)
os.makedirs(VUE_PUBLIC_UNITS_DIR, exist_ok=True)

# Helper to recursively resolve spec inheritance with pa_ex1 overlay mounting
def resolve_spec(spec_path):
    if not spec_path:
        return {}
    
    # Clean lead slashes
    rel_path = spec_path.lstrip('/')
    
    # Try pa_ex1 folder overlay first for Titans expansion units
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
            # Shallow merge dictionaries
            merged_dict = merged[k].copy()
            merged_dict.update(v)
            merged[k] = merged_dict
        elif isinstance(v, list) and k in merged and isinstance(merged[k], list):
            # For lists, we overwrite them (standard PA behavior for things like unit_types or tools)
            merged[k] = v
        else:
            merged[k] = v
            
    return merged

# Helper to evaluate boolean expressions of unit types
def eval_expr(expr_str, unit_types_set):
    if not expr_str:
        return False
    
    # Normalize unit types to lower case and check without UNITTYPE_ prefix
    types = {t.replace("UNITTYPE_", "").lower(): True for t in unit_types_set}
    
    # Tokenize the expression
    # E.g. "Bot & Mobile & Basic & FactoryBuild"
    tokens = re.findall(r'[a-zA-Z0-9_]+|[\&\|\-\(\)]', expr_str)
    
    py_tokens = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok == '&':
            py_tokens.append('and')
        elif tok == '|':
            py_tokens.append('or')
        elif tok == '-':
            py_tokens.append('and not')
        elif tok in ('(', ')'):
            py_tokens.append(tok)
        elif tok.isalnum() or '_' in tok:
            type_lower = tok.lower()
            if type_lower.startswith("custom") or type_lower.startswith("unittype_custom"):
                val = "True"
            else:
                val = str(types.get(type_lower, False))
            py_tokens.append(val)
        i += 1
        
    py_expr = " ".join(py_tokens)
    try:
        return eval(py_expr)
    except Exception as e:
        # print(f"Error evaluating {expr_str} -> {py_expr}: {e}")
        return False

def clean_text(text):
    if not text:
        return ""
    text_str = str(text)
    # Remove leading !LOC: or !LOC or !
    text_str = re.sub(r'^!LOC:?', '', text_str)
    text_str = re.sub(r'^!', '', text_str)
    return text_str.strip()

def main():
    print(f"Loading unit list from {UNIT_LIST_PATH}...")
    with open(UNIT_LIST_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    all_units_raw = data['units']
    
    # Load expansion unit list (Titans)
    ex_list_path = os.path.join(GAME_MEDIA_DIR, "pa_ex1", "units", "unit_list.json")
    if os.path.exists(ex_list_path):
        print(f"Loading expansion unit list from {ex_list_path}...")
        try:
            with open(ex_list_path, 'r', encoding='utf-8') as f:
                ex_data = json.load(f)
            # Combine without duplicates
            all_units_raw = list(set(all_units_raw + ex_data['units']))
        except Exception as e:
            print(f"Error loading expansion unit list: {e}")

    print(f"Found {len(all_units_raw)} total specs in combined lists.")
    
    parsed_units = []
    
    for spec_path in all_units_raw:
        # Resolve full specification recursively
        spec = resolve_spec(spec_path)
        if not spec:
            continue
            
        # Get path details
        rel_path = spec_path.lstrip('/')
        
        # Try pa_ex1 overlay first
        if rel_path.startswith('pa/'):
            ex1_path = rel_path.replace('pa/', 'pa_ex1/', 1)
            abs_json_path = os.path.join(GAME_MEDIA_DIR, ex1_path)
            if not os.path.exists(abs_json_path):
                abs_json_path = os.path.join(GAME_MEDIA_DIR, rel_path)
        else:
            abs_json_path = os.path.join(GAME_MEDIA_DIR, rel_path)
            
        unit_folder = os.path.dirname(abs_json_path)
        
        # Look for buildbar icon
        buildbar_icons = glob.glob(os.path.join(unit_folder, "*_icon_buildbar.png"))
        
        # Fallback: if no buildbar icon in overlay folder, check base folder
        if not buildbar_icons and "pa_ex1" in unit_folder:
            base_unit_folder = unit_folder.replace("pa_ex1", "pa", 1)
            buildbar_icons = glob.glob(os.path.join(base_unit_folder, "*_icon_buildbar.png"))
        
        # If there's no buildbar icon, skip this unit since it's likely an abstract class or hidden
        if not buildbar_icons:
            continue
            
        icon_src = buildbar_icons[0]
        # Generate safe image name for Vue public folder
        # e.g., /pa/units/land/laser_defense/laser_defense.json -> pa_units_land_laser_defense_laser_defense.png
        safe_img_name = spec_path.strip('/').replace('/', '_').replace('.json', '.png')
        icon_dest = os.path.join(VUE_PUBLIC_UNITS_DIR, safe_img_name)
        
        # Copy and make black background transparent
        try:
            from PIL import Image
            img = Image.open(icon_src).convert("RGBA")
            datas = img.getdata()
            newData = []
            for item in datas:
                # If pixel is very close to black
                if item[0] < 12 and item[1] < 12 and item[2] < 12:
                    newData.append((0, 0, 0, 0))
                else:
                    newData.append(item)
            img.putdata(newData)
            img.save(icon_dest, "PNG")
        except Exception as e:
            print(f"Could not transparentize icon {icon_src} to {icon_dest}: {e}")
            shutil.copy2(icon_src, icon_dest)
            
        # Extract basic info
        name = clean_text(spec.get('unit_name') or spec.get('display_name'))
        if not name:
            name = os.path.basename(spec_path).replace('.json', '').replace('_', ' ').title()
            
        desc = clean_text(spec.get('description'))
        health = spec.get('max_health', 0)
        cost = spec.get('build_metal_cost', 0)
        unit_types = spec.get('unit_types', [])
        
        # Determine category based on folder or types
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
            
        # Parse weapons and tools to compute DPS & Range
        weapons = []
        tools = spec.get('tools', [])
        for tool_entry in tools:
            tool_spec_path = tool_entry.get('spec_id')
            if not tool_spec_path:
                continue
                
            tool_spec = resolve_spec(tool_spec_path)
            if not tool_spec:
                continue
                
            # We want weapons (not builders/radar tools)
            tool_type = tool_spec.get('tool_type', 'TOOL_Weapon')
            if tool_type != 'TOOL_Weapon' and 'ammo_id' not in tool_spec:
                continue
                
            ammo_val = tool_spec.get('ammo_id')
            if not ammo_val:
                continue
                
            # If ammo_id is a list of objects, resolve the first one
            ammo_spec_path = None
            if isinstance(ammo_val, list):
                if len(ammo_val) > 0 and isinstance(ammo_val[0], dict):
                    ammo_spec_path = ammo_val[0].get('id')
            elif isinstance(ammo_val, str):
                ammo_spec_path = ammo_val
                
            if not ammo_spec_path:
                continue
                
            ammo_spec = resolve_spec(ammo_spec_path)
            damage = ammo_spec.get('damage', 0)
            rate_of_fire = tool_spec.get('rate_of_fire', 1.0)
            max_range = tool_spec.get('max_range', 0)
            
            dps = rate_of_fire * damage
            target_layers = tool_spec.get('target_layers')
            if not target_layers:
                target_layers = ['WL_LandHorizontal', 'WL_WaterSurface']
                
            if dps > 0 or max_range > 0:
                weapons.append({
                    'dps': dps,
                    'range': max_range,
                    'damage': damage,
                    'rate_of_fire': rate_of_fire,
                    'target_layers': target_layers
                })
                
        total_dps = sum(w['dps'] for w in weapons)
        max_range = max([w['range'] for w in weapons]) if weapons else 0
        
        # Check if it has factory/builder capabilities
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
        
        # Determine layers this unit occupies during combat
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
            'id': spec_path,
            'name': name,
            'description': desc,
            'health': health,
            'cost': cost,
            'category': category,
            'unit_types': unit_types,
            'is_factory': is_factory,
            'buildable_types': buildable_types,
            'weapons': weapons,
            'dps': total_dps,
            'range': max_range,
            'icon': f"/units/{safe_img_name}",
            'buildable_unit_ids': [],  # Will be populated in next step
            'layers': layers
        })
        
    print(f"Initially parsed {len(parsed_units)} active units with icons.")
    
    # Resolve factory relations
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
    
    # Save the database
    output_json_path = os.path.join(VUE_DATA_DIR, "units.json")
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(parsed_units, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully wrote unit data to {output_json_path}")
    print(f"Done extracting images to {VUE_PUBLIC_UNITS_DIR}")

if __name__ == "__main__":
    main()
