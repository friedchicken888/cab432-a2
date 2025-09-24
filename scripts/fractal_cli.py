import os
import requests
import json

BASE_URL = ""
USERS = {
    "user": {"username": "user", "password": "user"},
    "admin": {"username": "admin", "password": "admin"}
}

current_user_role = None
current_token = None

def login(username, password):
    global current_token, current_user_role
    try:
        r = requests.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
        r.raise_for_status()
        data = r.json()
        current_token = data['token']
        current_user_role = username
        print(f"Logged in as {username}.")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Login failed: {e}")
        current_token = None
        current_user_role = None
        return False

def generate_fractal():
    if not current_token:
        print("Please log in first.")
        return

    print("\n--- Generate Fractal ---")
    print("Enter parameters (leave blank for default/random):")
    width = input("Width (default 1920): ")
    height = input("Height (default 1080): ")
    iterations = input("Max Iterations (default 500): ")
    power = input("Power (default 2): ")
    c_real = input("C Real (default 0.285): ")
    c_imag = input("C Imag (default 0.01): ")
    scale = input("Scale (default 1): ")
    offset_x = input("Offset X (default 0): ")
    offset_y = input("Offset Y (default 0): ")
    color_scheme = input("Color Scheme (rainbow, grayscale, fire, hsl - default rainbow): ")

    params = {}
    if width: params["width"] = int(width)
    if height: params["height"] = int(height)
    if iterations: params["iterations"] = int(iterations)
    if power: params["power"] = float(power)
    if c_real: params["real"] = float(c_real)
    if c_imag: params["imag"] = float(c_imag)
    if scale: params["scale"] = float(scale)
    if offset_x: params["offsetX"] = float(offset_x)
    if offset_y: params["offsetY"] = float(offset_y)
    if color_scheme: params["color"] = color_scheme

    headers = {"Authorization": f"Bearer {current_token}"}
    try:
        r = requests.get(f"{BASE_URL}/fractal", headers=headers, params=params, timeout=180)
        r.raise_for_status()
        data = r.json()
        fractal_url = data.get('url')
        fractal_hash = data.get('hash')
        if fractal_url:
            print(f"\nFractal generated successfully! URL: {fractal_url}")
        elif fractal_hash:
            print(f"\nFractal generated successfully! Hash: {fractal_hash}")
        else:
            print(f"\nFractal generated successfully! Unexpected response: {data}")
    except requests.exceptions.RequestException as e:
        print(f"\nFractal generation failed: {e}")

def view_data(view_type="my_gallery", limit=None, offset=None, filters=None, sortBy=None, sortOrder=None, prompt_for_filters=True):
    if not current_token:
        print("Please log in first.")
        return

    endpoint = ""
    title = ""

    if view_type == "my_gallery":
        endpoint = "/gallery"
        title = "My Gallery"
    elif view_type == "all_history":
        if current_user_role != "admin":
            print("Admin privileges required to view all history.")
            return
        endpoint = "/admin/history"
        title = "All History"
    elif view_type == "all_gallery":
        if current_user_role != "admin":
            print("Admin privileges required to view all gallery.")
            return
        endpoint = "/admin/gallery"
        title = "All Gallery"
    else:
        print("Invalid view type.")
        return

    query_params = {}
    if limit is not None: query_params["limit"] = int(limit)
    if offset is not None: query_params["offset"] = int(offset)

    if prompt_for_filters:
        print("\n--- Filters (leave blank to skip) ---")
        colorScheme = input("Color Scheme: ")
        power = input("Power: ")
        iterations = input("Max Iterations: ")
        width = input("Width: ")
        height = input("Height: ")
        
        filters = {}
        if colorScheme: filters["colorScheme"] = colorScheme
        if power: filters["power"] = float(power)
        if iterations: filters["iterations"] = int(iterations)
        if width: filters["width"] = int(width)
        if height: filters["height"] = int(height)

    for k, v in filters.items():
        query_params[k] = v

    if sortBy is None: sortBy = input("Sort By (e.g., added_at, hash, width - leave blank for default): ")
    if sortOrder is None: sortOrder = input("Sort Order (ASC/DESC - leave blank for default): ")
    if sortBy: query_params["sortBy"] = sortBy
    if sortOrder: query_params["sortOrder"] = sortOrder

    clear_terminal()

    headers = {"Authorization": f"Bearer {current_token}"}
    try:
        r = requests.get(f"{BASE_URL}{endpoint}", headers=headers, params=query_params)
        r.raise_for_status()
        response_data = r.json()
        data = response_data.get('data', [])
        total_count = response_data.get('totalCount', len(data))
        current_limit = response_data.get('limit', len(data))
        current_offset = response_data.get('offset', 0)

        if data:
            print(f"\n--- {title} (Total: {total_count}, Showing {current_offset}-{current_offset + len(data)} of {total_count}) ---")
            for entry in data:
                timestamp_field = 'added_at' if 'added_at' in entry else 'generated_at'
                user_info = f", User: {entry.get('username')}" if 'username' in entry else ''
                
                fractal_hash = entry.get('hash')
                display_hash = fractal_hash[:8] + '...' if fractal_hash else 'N/A (Deleted)'
                
                width = entry.get('width', 'N/A')
                height = entry.get('height', 'N/A')
                iterations = entry.get('iterations', 'N/A')
                power = entry.get('power', 'N/A')
                c_real = entry.get('c_real', 'N/A')
                c_imag = entry.get('c_imag', 'N/A')
                scale = entry.get('scale', 'N/A')
                offset_x = entry.get('offsetX', 'N/A')
                offset_y = entry.get('offsetY', 'N/A')
                color_scheme = entry.get('colorScheme', 'N/A')

                print(f"ID: {entry.get('id')}, Hash: {display_hash}{user_info}, Time: {entry.get(timestamp_field)}")
                print(f"  Params: W:{width}, H:{height}, Iter:{iterations}, Power:{power}, C:{c_real}+{c_imag}i, Scale:{scale}, Offset:{offset_x},{offset_y}, Color:{color_scheme}")
                if entry.get('url'):
                    print(f"  URL: {entry.get('url')}\n")
                
            return {'data': data, 'totalCount': total_count, 'limit': current_limit, 'offset': current_offset, 'filters': filters, 'sortBy': sortBy, 'sortOrder': sortOrder}
        else:
            print(f"No {title.lower()} items found for the current query.")
            return {'data': [], 'totalCount': total_count, 'limit': current_limit, 'offset': current_offset, 'filters': filters, 'sortBy': sortBy, 'sortOrder': sortOrder}
    except requests.exceptions.RequestException as e:
        print(f"Failed to retrieve {title.lower()}: {e}")
        if e.response is not None:
            print(f"HTTP Status Code: {e.response.status_code}")
            print(f"Response Body: {e.response.text}")

def clear_terminal():
    os.system('cls' if os.name == 'nt' else 'clear')

def delete_gallery_entry():
    if not current_token:
        print("Please log in first.")
        return

    gallery_id = input("Enter Gallery ID to delete: ")
    if not gallery_id.isdigit():
        print("Invalid ID. Please enter a number.")
        return

    headers = {"Authorization": f"Bearer {current_token}"}
    try:
        r = requests.delete(f"{BASE_URL}/gallery/{gallery_id}", headers=headers)
        r.raise_for_status()
        print(f"Gallery entry {gallery_id} deleted successfully.")
    except requests.exceptions.RequestException as e:
        print(f"Failed to delete gallery entry {gallery_id}: {e}")

def main_menu():
    global BASE_URL
    ip_address = input("Enter the server IP address (leave empty for localhost): ")
    if not ip_address:
        ip_address = "localhost"
    BASE_URL = f"http://{ip_address}:3000/api"
    

    while True:
        clear_terminal()
        print("\n--- Main Menu ---")
        if current_user_role:
            print(f"Logged in as: {current_user_role}")
        else:
            print("Not logged in.")

        print("1. Select User (Login)")
        print("2. Generate Fractal")
        print("3. View My Gallery")
        if current_user_role == "admin":
            print("4. View All History (Admin)")
            print("5. View All Gallery (Admin)")
        print("6. Delete Gallery Entry")
        print("7. Exit")

        print()
        choice = input("Enter your choice: ")
        
        if choice == "1":
            clear_terminal()
            print("\nSelect user:")
            print("  1. user")
            print("  2. user2")
            print("  3. admin")
            user_choice_num = input("\nEnter choice (1, 2 or 3): ")
            selected_user = None
            if user_choice_num == "1":
                selected_user = "user"
            elif user_choice_num == "2":
                selected_user = "user2"
            elif user_choice_num == "3":
                selected_user = "admin"
            else:
                print("Invalid choice.")

            if selected_user:
                login(USERS[selected_user]["username"], USERS[selected_user]["password"])
            input("\nPress Enter to continue...")
            
        elif choice == "2":
            clear_terminal()
            generate_fractal()
            input("\nPress Enter to continue...")
            
        elif choice == "3":
            current_limit = None
            current_offset = 0
            print("\n--- View My Gallery ---")
            limit_input = input(f"Enter limit (leave blank for default 5, current: {current_limit if current_limit is not None else 'default'}):")
            offset_input = input(f"Enter offset (leave blank for current {current_offset}): ")
            
            limit = int(limit_input) if limit_input else current_limit
            offset = int(offset_input) if offset_input else current_offset

            if limit is None:
                limit = 5

            filters = None
            sortBy = None
            sortOrder = None
            prompt_for_filters_my_gallery = True

            while True:
                result = view_data(view_type="my_gallery", limit=limit, offset=offset, filters=filters, sortBy=sortBy, sortOrder=sortOrder, prompt_for_filters=prompt_for_filters_my_gallery)
                
                if result:
                    current_limit = result['limit']
                    current_offset = result['offset']
                    total_count = result['totalCount']
                    filters = result['filters']
                    sortBy = result['sortBy']
                    sortOrder = result['sortOrder']
                    prompt_for_filters_my_gallery = False
                    
                    has_more_pages = current_offset + len(result['data']) < total_count
                    can_go_back = current_offset > 0

                    if result['data'] and (has_more_pages or can_go_back):
                        print("\nNavigation:")
                        if can_go_back:
                            print("  1. Previous Page")
                        if has_more_pages:
                            print("  2. Next Page")
                        print("  Any other key to exit pagination.")

                        nav_choice = input("Enter your choice: ")

                        if nav_choice == '1' and can_go_back:
                            clear_terminal()
                            offset = max(0, offset - current_limit)
                            continue
                        elif nav_choice == '2' and has_more_pages:
                            clear_terminal()
                            offset += current_limit
                            continue
                    break
                else:
                    break
            input("\nPress Enter to continue...")
        
        elif choice == "4" and current_user_role == "admin":
            current_limit = None
            current_offset = 0
            print("\n--- View All History (Admin) ---")
            limit_input = input(f"Enter limit (leave blank for default 5, current: {current_limit if current_limit is not None else 'default'}):")
            offset_input = input(f"Enter offset (leave blank for current {current_offset}): ")
                
            limit = int(limit_input) if limit_input else current_limit
            offset = int(offset_input) if offset_input else current_offset

            if limit is None:
                limit = 5

            filters = None
            sortBy = None
            sortOrder = None
            prompt_for_filters_all_history = True

            while True:
                result = view_data(view_type="all_history", limit=limit, offset=offset, filters=filters, sortBy=sortBy, sortOrder=sortOrder, prompt_for_filters=prompt_for_filters_all_history)
                
                if result:
                    current_limit = result['limit']
                    current_offset = result['offset']
                    total_count = result['totalCount']
                    filters = result['filters']
                    sortBy = result['sortBy']
                    sortOrder = result['sortOrder']
                    prompt_for_filters_all_history = False
                    
                    has_more_pages = current_offset + len(result['data']) < total_count
                    can_go_back = current_offset > 0

                    if result['data'] and (has_more_pages or can_go_back):
                        print("\nNavigation:")
                        if can_go_back:
                            print("  1. Previous Page")
                        if has_more_pages:
                            print("  2. Next Page")
                        print("  Any other key to exit pagination.")

                        nav_choice = input("Enter your choice: ")

                        if nav_choice == '1' and can_go_back:
                            clear_terminal()
                            offset = max(0, offset - current_limit)
                            
                            continue
                        elif nav_choice == '2' and has_more_pages:
                            clear_terminal()
                            offset += current_limit
                            
                            continue
                    break
                else:
                    break
            input("\nPress Enter to continue...")
        elif choice == "5" and current_user_role == "admin":
            current_limit = None
            current_offset = 0
            print("\n--- View All Gallery (Admin) ---")
            limit_input = input(f"Enter limit (leave blank for default 5, current: {current_limit if current_limit is not None else 'default'}):")
            offset_input = input(f"Enter offset (leave blank for current {current_offset}): ")
                
            limit = int(limit_input) if limit_input else current_limit
            offset = int(offset_input) if offset_input else current_offset

            if limit is None:
                limit = 5

            filters = None
            sortBy = None
            sortOrder = None
            prompt_for_filters_all_gallery = True

            while True:
                result = view_data(view_type="all_gallery", limit=limit, offset=offset, filters=filters, sortBy=sortBy, sortOrder=sortOrder, prompt_for_filters=prompt_for_filters_all_gallery)
                
                if result:
                    current_limit = result['limit']
                    current_offset = result['offset']
                    total_count = result['totalCount']
                    filters = result['filters']
                    sortBy = result['sortBy']
                    sortOrder = result['sortOrder']
                    prompt_for_filters_all_gallery = False
                    
                    has_more_pages = current_offset + len(result['data']) < total_count
                    can_go_back = current_offset > 0

                    if result['data'] and (has_more_pages or can_go_back):
                        print("\nNavigation:")
                        if can_go_back:
                            print("  1. Previous Page")
                        if has_more_pages:
                            print("  2. Next Page")
                        print("  Any other key to exit pagination.")

                        nav_choice = input("Enter your choice: ")

                        if nav_choice == '1' and can_go_back:
                            clear_terminal()
                            offset = max(0, offset - current_limit)
                            continue
                        elif nav_choice == '2' and has_more_pages:
                            clear_terminal()
                            offset += current_limit
                            
                            continue
                    break
                else:
                    break
            input("\nPress Enter to continue...")
        elif choice == "6":
            clear_terminal()
            delete_gallery_entry()
            input("\nPress Enter to continue...")
            
        elif choice == "7":
            clear_terminal()
            print("\nExiting CLI. Goodbye!")
            break
        else:
            print("\nInvalid choice. Please try again.")
            input("Press Enter to continue...")

if __name__ == "__main__":
    main_menu()